import { Scene } from "phaser";
import { AssetService } from "../core/services/AssetService";
import { TimelineService } from "../core/services/TimelineService";
import { Helpers } from "../core/utils/Helpers";
import {
  MessageModal,
  showMessage,
  createErrorMessage,
  createInfoMessage,
  createSuccessMessage,
} from "../ui/ErrorModal/MessageModal";
import {
  TimelineJson,
  TimelineElement,
} from "../types/interfaces/TimelineInterfaces";
import {
  AssetJson,
  AssetElement,
  AssetDisplayProperties,
  AssetInfo,
} from "../types/interfaces/AssetInterfaces";
import { SpineGameObject } from "@esotericsoftware/spine-phaser";
// Also import the constructor/class itself
import * as Spine from "@esotericsoftware/spine-phaser";

export class JsonManager {
  private scene: Scene;
  private assetService: AssetService;
  private timelineService: TimelineService | null = null;
  private currentTimelineJson: TimelineJson | null = null;
  private messageModal: MessageModal | null = null;
  private animationService: any; // זמני עד שתגדיר AnimationService

  constructor(scene: Scene, assetService: AssetService) {
    this.scene = scene;
    this.assetService = assetService;
    // זמנית: במקום AnimationService, נשתמש ב-Phaser tweens כמקום חלופי
    this.animationService = {
      applyAnimations: (sprite: any, element: TimelineElement) => {
        console.log(`Placeholder: Applying animations to ${element.assetName}`);
        // לדוגמה: שימוש ב-Phaser tweens אם אין AnimationService
        if (element.timeline?.position) {
          this.scene.tweens.add({
            targets: sprite,
            x: element.timeline.position[0]?.value?.x || sprite.x,
            y: element.timeline.position[0]?.value?.y || sprite.y,
            duration: element.timeline.position[0]?.duration || 1000,
          });
        }
      },
    };
  }

  private validateAssetsJson(json: AssetJson): void {
    console.log("Validating assets JSON:", json);

    if (!json || typeof json !== "object") {
      throw new Error("Invalid assets JSON structure: root must be an object");
    }

    if (!json.assets || !Array.isArray(json.assets)) {
      throw new Error(
        "Invalid assets JSON structure: missing or invalid assets array"
      );
    }

    json.assets.forEach((asset, index) => {
      if (!asset.assetName) {
        throw new Error(`Missing asset name at index ${index}`);
      }
      if (!asset.assetType) {
        throw new Error(`Missing asset type for: ${asset.assetName}`);
      }
      if (!asset.assetUrl) {
        throw new Error(`Missing asset URL for: ${asset.assetName}`);
      }

      if (
        asset.scale_override &&
        (typeof asset.scale_override.x !== "number" ||
          typeof asset.scale_override.y !== "number")
      ) {
        throw new Error(`Invalid scale override for asset: ${asset.assetName}`);
      }
      if (
        asset.aspect_ratio_override &&
        (typeof asset.aspect_ratio_override.width !== "number" ||
          typeof asset.aspect_ratio_override.height !== "number")
      ) {
        throw new Error(
          `Invalid aspect ratio override for asset: ${asset.assetName}`
        );
      }
      if (
        asset.pivot_override &&
        (typeof asset.pivot_override.x !== "number" ||
          typeof asset.pivot_override.y !== "number")
      ) {
        throw new Error(`Invalid pivot override for asset: ${asset.assetName}`);
      }
    });
  }

  private async ValidateAssetExistence(assets: AssetElement[]): Promise<{
    missingAssets: string[];
    loadedAssets: string[];
    failedAssets: string[];
  }> {
    const missingAssets: string[] = [];
    const loadedAssets: string[] = [];
    const failedAssets: string[] = [];

    for (const asset of assets) {
      try {
        let urlToFetch: string;
        if (asset.assetType === "spine" && typeof asset.assetUrl !== "string") {
          urlToFetch = (asset.assetUrl as { skeletonUrl: string }).skeletonUrl;
        } else {
          urlToFetch = asset.assetUrl as string;
        }

        const response = await fetch(urlToFetch);
        if (response.status === 200) {
          loadedAssets.push(`${asset.assetName} (${urlToFetch})`);
        } else {
          missingAssets.push(asset.assetName);
        }
      } catch (error) {
        failedAssets.push(
          `${asset.assetName} (${JSON.stringify(asset.assetUrl)}) - ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return {
      missingAssets: [...new Set(missingAssets)],
      loadedAssets,
      failedAssets,
    };
  }

  public async handleAssetsJson(file: File): Promise<void> {
    try {
      const fileContent = await file.text();
      const json = JSON.parse(fileContent) as AssetJson;

      this.validateAssetsJson(json);

      const { missingAssets, loadedAssets, failedAssets } =
        await this.ValidateAssetExistence(json.assets);

      const messages: any[] = [];
      const hasErrors = missingAssets.length > 0 || failedAssets.length > 0;

      if (hasErrors) {
        messages.push(
          createErrorMessage("Warning: Some assets may be missing or invalid:")
        );
      }

      if (missingAssets.length > 0) {
        missingAssets.forEach((asset) =>
          messages.push(createErrorMessage(asset))
        );
      }

      if (failedAssets.length > 0) {
        messages.push(createInfoMessage("Failed to verify assets:"));
        failedAssets.forEach((asset) =>
          messages.push(createErrorMessage(asset))
        );
      }

      messages.push(
        createInfoMessage(`Total assets loaded: ${loadedAssets.length}`),
        createInfoMessage(`Types: ${this.getAssetTypesSummary(json)}`)
      );

      if (loadedAssets.length > 0) {
        loadedAssets.forEach((asset) => {
          const assetDetails = this.getAssetDetails(json, asset);
          messages.push(createSuccessMessage(assetDetails));
        });
      } else {
        messages.push(createInfoMessage("No assets loaded"));
      }

      showMessage({
        isOpen: true,
        title: `Assets Loaded - ${file.name}`,
        messages,
        autoClose: !hasErrors,
        autoCloseTime: hasErrors ? 8000 : 5000,
      });

      await this.assetService.handleAssetsJson(file);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? this.getDetailedErrorMessage(error, file.name)
          : `Failed to load assets from ${file.name}`;

      showMessage({
        isOpen: true,
        title: "Error Loading Assets",
        messages: [createErrorMessage(errorMessage)],
        autoClose: false,
      });

      console.error("Error in handleAssetsJson:", error);
      throw error;
    }
  }

  public async handleTimelineJson(file: File): Promise<void> {
    try {
      console.log(`Starting to process timeline JSON file: ${file.name}`);

      this.resetTimelineState();

      this.timelineService = new TimelineService(
        this.assetService.getAssetsMap(),
        this.assetService
      );
      console.log("TimelineService initialized");

      const json = await this.parseTimelineJson(file);
      if (!json) {
        throw new Error("Failed to parse timeline JSON");
      }
      console.log("Timeline JSON parsed successfully:", json);

      const validationErrors = await this.timelineService.validateTimelineJson(
        json
      );
      console.log("Validation completed, errors:", validationErrors);
      if (validationErrors.length > 0) {
        showMessage({
          isOpen: true,
          title: "Timeline Validation Errors",
          messages: validationErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      console.log("Starting asset validation and loading");
      const assetValidationResults =
        await this.timelineService.validateAndLoadAssets(
          json["template video json"]
        );
      console.log("Asset validation results:", assetValidationResults);

      this.currentTimelineJson = json;
      console.log("Displaying timeline assets");
      this.displayTimelineAssets(json["template video json"]);

      console.log("Calling displayLoadResults");
      this.timelineService.displayLoadResults(assetValidationResults);
      console.log("handleTimelineJson completed");
    } catch (error) {
      console.error("Error in handleTimelineJson:", error);
      const errorMessage =
        error instanceof Error
          ? this.getDetailedErrorMessage(error, file.name)
          : `Failed to load timeline from ${file.name}`;

      showMessage({
        isOpen: true,
        title: "Error Loading Timeline",
        messages: [createErrorMessage(errorMessage)],
        autoClose: false,
      });

      throw error;
    }
  }

  private resetTimelineState(): void {
    if (this.currentTimelineJson) {
      this.assetService.hideAllAssets();
      this.currentTimelineJson = null;
    }
  }

  private displayTimelineAssets(timelineElements: TimelineElement[]): void {
    console.log("helooo");
    console.log(
      "(container) Starting displayTimelineAssets with elements:",
      timelineElements.map((e) => e.assetName)
    );
    // שמירת רשימת האלמנטים הפעילים בתוך ה-timeline
    const activeAssets = new Set<string>();

    // עדכון אובייקטים קיימים או יצירת חדשים לפי הצורך
    timelineElements.forEach((element) => {
      if (element.assetName && element.initialState) {
        activeAssets.add(element.assetName);
        const {
          position = { x: 0, y: 0 },
          scale = { x: 1, y: 1 },
          opacity = 1,
          rotation = 0,
          color = "0xFFFFFF",
          animation,
        } = element.initialState;

        // בדיקה אם האובייקט כבר קיים
        const assetInfo = this.assetService.getAssetInfo(element.assetName);
        let sprite;

        if (assetInfo && "sprite" in assetInfo && assetInfo.sprite) {
          // אם האובייקט קיים, רק נעדכן את המאפיינים שלו
          sprite = assetInfo.sprite;
          console.log(`Updating existing asset: ${element.assetName}`, sprite);

          const hasContainer = assetInfo.container !== undefined;
          console.log(
            `Asset ${element.assetName} has container:`,
            hasContainer
          );

          // טיפול באובייקטים מסוגים שונים
          if (
            sprite instanceof Phaser.GameObjects.Sprite ||
            sprite instanceof Phaser.GameObjects.Video
          ) {
            if (hasContainer) {
              // אם יש קונטיינר, עדכן אותו במקום את הספרייט ישירות
              assetInfo.container?.setPosition(position.x, position.y);
              assetInfo.container?.setScale(scale.x, scale.y);
              assetInfo.container?.setAlpha(opacity);
              assetInfo.container?.setRotation(rotation);
              // הספרייט כבר בתוך הקונטיינר, אז לא צריך לעדכן את המיקום שלו
              sprite.setTint(parseInt(color.replace("0x", ""), 16));
            } else {
              sprite.setPosition(position.x, position.y);
              sprite.setScale(scale.x, scale.y);
              sprite.setAlpha(opacity);
              sprite.setRotation(rotation);
              sprite.setTint(parseInt(color.replace("0x", ""), 16));
            }
            sprite.setVisible(true);
          } else if (sprite instanceof SpineGameObject) {
            // טיפול דומה גם עבור spine
            if (hasContainer) {
              assetInfo.container?.setPosition(position.x, position.y);
              assetInfo.container?.setScale(scale.x, scale.y);
              assetInfo.container?.setAlpha(opacity);
              assetInfo.container?.setRotation(rotation);
            } else {
              sprite.setPosition(position.x, position.y);
              sprite.setScale(scale.x, scale.y);
              sprite.setAlpha(opacity);
              sprite.setRotation(rotation);
            }
            sprite.setVisible(true);

            // הפעלת אנימציה אם יש
            if (animation && (sprite.state || sprite.animationState)) {
              try {
                // בדיקה שה-skeleton קיים ותקין
                if (sprite.skeleton && sprite.skeleton.data) {
                  const animationNames = sprite.skeleton.data.animations.map(
                    (a) => a.name
                  );
                  console.log(
                    `Available animations for ${element.assetName}:`,
                    animationNames
                  );

                  if (animationNames.includes(animation)) {
                    if (sprite.animationState) {
                      sprite.animationState.setAnimation(0, animation, true);
                    } else if (sprite.state) {
                      // Type assertion to tell TypeScript that state is a Spine AnimationState
                      (sprite.state as any).setAnimation(0, animation, true);
                    }
                    console.log(
                      `Applied animation '${animation}' to ${element.assetName}`
                    );
                  } else if (animationNames.length > 0) {
                    const firstAnim = animationNames[0];
                    if (sprite.animationState) {
                      sprite.animationState.setAnimation(0, firstAnim, true);
                    } else if (sprite.state) {
                      // Type assertion to tell TypeScript that state is a Spine AnimationState
                      (sprite.state as any).setAnimation(0, firstAnim, true);
                    }
                    console.log(
                      `Animation '${animation}' not found, using '${firstAnim}' instead`
                    );
                  }
                } else {
                  console.warn(
                    `Spine object for ${element.assetName} has no skeleton data`
                  );
                }
              } catch (animError) {
                console.error(
                  `Error applying animation to ${element.assetName}:`,
                  animError
                );
              }
            }
          }
        } else {
          // אם האובייקט לא קיים או לא תקף, נצטרך ליצור אותו מחדש
          console.log(`Creating new asset: ${element.assetName}`);
          try {
            sprite = this.assetService.displayAsset(element.assetName, {
              x: position.x,
              y: position.y,
              scale: scale.x,
              alpha: opacity,
              rotation,
              tint: parseInt(color.replace("0x", ""), 16),
            });

            // אם יצרנו spine ויש אנימציה, ננסה להפעיל אותה
            if (
              element.assetType === "spine" &&
              sprite instanceof SpineGameObject &&
              animation
            ) {
              try {
                if (sprite.skeleton && sprite.skeleton.data) {
                  const animationNames = sprite.skeleton.data.animations.map(
                    (a) => a.name
                  );
                  const animToUse = animationNames.includes(animation)
                    ? animation
                    : animationNames.length > 0
                    ? animationNames[0]
                    : null;

                  if (animToUse) {
                    if (sprite.animationState) {
                      sprite.animationState.setAnimation(0, animToUse, true);
                    } else if (sprite.state) {
                      // Type assertion to tell TypeScript that state is a Spine AnimationState
                      (sprite.state as any).setAnimation(0, animToUse, true);
                    }
                  }
                }
              } catch (animError) {
                console.error(
                  `Error applying initial animation to new spine ${element.assetName}:`,
                  animError
                );
              }
            }
          } catch (error) {
            console.error(
              `Failed to create asset ${element.assetName}:`,
              error
            );
          }
        }

        // הפעלת אנימציות נוספות אם יש
        if (sprite && element.timeline) {
          console.log(`Applying animations for asset: ${element.assetName}`);
          this.animationService.applyAnimations(sprite, element);
        }
      }
    });

    // הסתרת אובייקטים שלא נמצאים ב-timeline הנוכחי
    this.assetService.getAssetsMap().forEach((assetInfo, assetName) => {
      if (
        !activeAssets.has(assetName) &&
        "sprite" in assetInfo &&
        assetInfo.sprite
      ) {
        const sprite = assetInfo.sprite;
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject
        ) {
          console.log(`Hiding inactive asset: ${assetName}`);
          sprite.setVisible(false);
        }
      }
    });
  }

  private generateAssetLoadingSummary(
    json: AssetJson,
    loadedAssets: string[],
    missingAssets: string[]
  ): string[] {
    const summary: string[] = [];
    const assetTypes = new Map<string, number>();

    if (missingAssets.length > 0) {
      summary.push("Missing assets:");
      missingAssets.forEach((asset) => summary.push(`- ${asset}`));
    }

    summary.push(`Total assets loaded: ${loadedAssets.length}`);

    const processedAssets = [...loadedAssets.map((a) => a.split(" (")[0])];
    processedAssets.forEach((assetName) => {
      const asset = json.assets.find((a) => a.assetName === assetName);
      if (asset) {
        const type = asset.assetType;
        assetTypes.set(type, (assetTypes.get(type) || 0) + 1);
      }
    });

    const typeSummary = Array.from(assetTypes.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
      .join(", ");

    summary.push(`Types: ${typeSummary}`);

    summary.push("Loaded assets:");
    if (loadedAssets.length > 0) {
      processedAssets.forEach((assetName) => {
        const asset = json.assets.find((a) => a.assetName === assetName);
        if (asset) {
          let assetDetails = `- ${asset.assetName} (${asset.assetType})`;

          const overrides: string[] = [];
          if (asset.scale_override) {
            overrides.push(
              `scale: ${asset.scale_override.x}x${asset.scale_override.y}`
            );
          }
          if (asset.aspect_ratio_override) {
            overrides.push(
              `aspect ratio: ${asset.aspect_ratio_override.width}x${asset.aspect_ratio_override.height}`
            );
          }
          if (asset.pivot_override) {
            overrides.push(
              `pivot: (${asset.pivot_override.x},${asset.pivot_override.y})`
            );
          }

          if (overrides.length > 0) {
            assetDetails += ` [${overrides.join(", ")}]`;
          }

          summary.push(assetDetails);
        }
      });
    } else {
      summary.push("No assets loaded");
    }

    return summary;
  }

  private generateTimelineSummary(json: TimelineJson): string[] {
    const summary: string[] = [];
    const elements = json["template video json"];

    if (!this.timelineService) {
      console.error("Timeline service is not initialized");
      return [
        "Error: Timeline service not initialized",
        `Total timeline elements: ${elements.length}`,
      ];
    }

    const assetsMap = this.assetService.getAssetsMap();
    console.log("Assets Map:", Array.from(assetsMap.entries()));
    console.log("Timeline Elements:", elements);

    const validElements: TimelineElement[] = [];
    const invalidElements: TimelineElement[] = [];

    elements.forEach((element) => {
      const assetInfo = assetsMap.get(element.assetName);

      if (!assetInfo) {
        console.warn(`Asset not found in assets map: ${element.assetName}`);
        invalidElements.push(element);
      } else if (assetInfo.type !== element.assetType) {
        console.warn(`Asset type mismatch for ${element.assetName}: 
          Timeline type: ${element.assetType}, 
          Loaded asset type: ${assetInfo.type}`);
        invalidElements.push(element);
      } else {
        validElements.push(element);
      }
    });

    const uniqueValidAssets = new Set(validElements.map((el) => el.assetName));

    summary.push(`Total timeline elements: ${elements.length}`);
    summary.push(`Valid timeline elements: ${validElements.length}`);
    summary.push(`Unique assets used: ${uniqueValidAssets.size}`);

    if (validElements.length > 0) {
      validElements.forEach((element, index) => {
        summary.push(
          `${index + 1}. ${element.assetName} (${element.assetType})`
        );
      });
    }

    if (invalidElements.length > 0) {
      invalidElements.forEach((element, index) => {
        summary.push(
          `${index + 1}. ${element.assetName} (${
            element.assetType
          }) - NOT LOADED`
        );
      });
    }

    return summary;
  }

  public async parseTimelineJson(file: File): Promise<TimelineJson | null> {
    try {
      const fileContent = await file.text();
      console.log(`Parsing timeline JSON file: ${file.name}`);

      const json = JSON.parse(fileContent);

      if (!json || typeof json !== "object") {
        throw new Error("Invalid JSON structure");
      }

      if (
        !json["template video json"] ||
        !Array.isArray(json["template video json"])
      ) {
        throw new Error(
          "Invalid timeline JSON: missing or invalid template video json"
        );
      }

      const invalidItems = json["template video json"].filter(
        (item) => !item.assetName || !item.assetType
      );

      if (invalidItems.length > 0) {
        console.error("Invalid timeline items:", invalidItems);
        throw new Error("Some timeline items are missing required fields");
      }

      return json as TimelineJson;
    } catch (error) {
      console.error("Timeline JSON parsing error:", error);
      throw new Error(
        `Failed to parse timeline JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private getDetailedErrorMessage(error: Error, fileName: string): string {
    if (error.message.includes("JSON")) {
      return `Invalid JSON format in ${fileName}: Please check the file structure`;
    }
    if (error.message.includes("asset")) {
      return `${error.message} in ${fileName}`;
    }
    return `${error.message} in ${fileName}`;
  }

  private getAssetTypesSummary(json: AssetJson): string {
    const typeCount = new Map<string, number>();
    json.assets.forEach((asset) => {
      const count = typeCount.get(asset.assetType) || 0;
      typeCount.set(asset.assetType, count + 1);
    });

    return Array.from(typeCount.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
      .join(", ");
  }

  private getAssetDetails(json: AssetJson, assetPath: string): string {
    const assetName = assetPath.split(" (")[0];
    const asset = json.assets.find((a) => a.assetName === assetName);

    if (!asset) return assetPath;

    const details: string[] = [];

    if (asset.scale_override) {
      details.push(
        `scale: ${asset.scale_override.x}x${asset.scale_override.y}`
      );
    }
    if (asset.aspect_ratio_override) {
      details.push(
        `aspect ratio: ${asset.aspect_ratio_override.width}x${asset.aspect_ratio_override.height}`
      );
    }
    if (asset.pivot_override) {
      details.push(
        `pivot: (${asset.pivot_override.x},${asset.pivot_override.y})`
      );
    }

    return details.length > 0
      ? `${asset.assetName} (${asset.assetType}) [${details.join(", ")}]`
      : `${asset.assetName} (${asset.assetType})`;
  }

  public getAssetUrl(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.url;
  }

  public getAssetType(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.type;
  }
}
