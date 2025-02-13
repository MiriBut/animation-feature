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
import { AnimationService } from "../core/services/AnimationService";

export class JsonManager {
  private scene: Scene;
  private assetService: AssetService;
  private timelineService: TimelineService | null = null;
  private currentTimelineJson: TimelineJson | null = null;
  private messageModal: MessageModal | null = null;
  private animationService: AnimationService;

  constructor(scene: Scene, assetService: AssetService) {
    this.scene = scene;
    this.assetService = assetService;
    this.animationService = new AnimationService(scene);
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

  private async validateAssetExistence(assets: AssetElement[]): Promise<{
    missingAssets: string[];
    loadedAssets: string[];
    failedAssets: string[];
  }> {
    const missingAssets: string[] = [];
    const loadedAssets: string[] = [];
    const failedAssets: string[] = [];

    for (const asset of assets) {
      try {
        const response = await fetch(asset.assetUrl);
        if (response.status === 200) {
          loadedAssets.push(`${asset.assetName} (${asset.assetUrl})`);
        } else {
          missingAssets.push(asset.assetName);
        }
      } catch (error) {
        failedAssets.push(
          `${asset.assetName} (${asset.assetUrl}) - ${
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
        await this.validateAssetExistence(json.assets);

      const messages: any[] = [];
      const hasErrors = missingAssets.length > 0 || failedAssets.length > 0;

      // הודעת אזהרה כללית
      if (hasErrors) {
        messages.push(
          createErrorMessage("Warning: Some assets may be missing or invalid:")
        );
      }

      // נכסים חסרים
      if (missingAssets.length > 0) {
        // messages.push(createInfoMessage("Missing assets: " + missingAssets));
        missingAssets.forEach((asset) =>
          messages.push(createErrorMessage(asset))
        );
      }

      // נכסים שנכשלו
      if (failedAssets.length > 0) {
        messages.push(createInfoMessage("Failed to verify assets:"));
        failedAssets.forEach((asset) =>
          messages.push(createErrorMessage(asset))
        );
      }

      // סיכום נכסים
      messages.push(
        createInfoMessage(`Total assets loaded: ${loadedAssets.length}`),
        createInfoMessage(`Types: ${this.getAssetTypesSummary(json)}`)
      );

      // נכסים טעונים
      // messages.push(createInfoMessage("Loaded assets:"));
      console.log("Debug - loadedAssets:", loadedAssets);
      console.log("Debug - JSON:", json);

      if (loadedAssets.length > 0) {
        loadedAssets.forEach((asset) => {
          console.log("Debug - Processing asset:", asset);
          const assetDetails = this.getAssetDetails(json, asset);
          console.log("Debug - Asset details:", assetDetails);
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

      //if (!hasErrors) {

      missingAssets.forEach((asset) => console.log("+ missing asset:" + asset));
      await this.assetService.handleAssetsJson(json, missingAssets);
      // }
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

      // Initialize TimelineService with current assets map
      this.timelineService = new TimelineService(
        this.assetService.getAssetsMap()
      );

      const json = await this.parseTimelineJson(file);
      if (!json) {
        throw new Error("Failed to parse timeline JSON");
      }

      // Validate timeline JSON structure
      const validationErrors = await this.timelineService.validateTimelineJson(
        json
      );

      if (validationErrors.length > 0) {
        showMessage({
          isOpen: true,
          title: "Timeline Validation Errors",
          messages: validationErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      this.currentTimelineJson = json;
      this.displayTimelineAssets(json["template video json"]);

      showMessage({
        isOpen: true,
        title: `Timeline Loaded - ${file.name}`,
        messages: this.generateTimelineSummary(json).map((summary) => {
          if (
            summary.startsWith("Total timeline elements:") ||
            summary.startsWith("Unique assets used:")
          ) {
            return createInfoMessage(summary);
          }
          if (summary.includes("- NOT LOADED")) {
            return createErrorMessage(summary);
          }
          if (/^\d+\./.test(summary)) {
            return createSuccessMessage(summary);
          }
          return createInfoMessage(summary);
        }),
        autoClose: true,
        autoCloseTime: 5000,
      });
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
    this.assetService.hideAllAssets();

    timelineElements.forEach((element) => {
      if (element.assetName && element.initialState) {
        const {
          position = { x: 0, y: 0 },
          scale = { x: 1, y: 1 },
          opacity = 1,
          rotation = 0,
          color = "0xFFFFFF",
        } = element.initialState;

        try {
          const sprite = this.assetService.displayAsset(element.assetName, {
            x: position.x,
            y: position.y,
            scale: scale.x,
            alpha: opacity,
            rotation,
            tint: parseInt(color),
          });

          if (sprite && element.timeline) {
            console.log(`Applying animations for asset: ${element.assetName}`);
            this.animationService.applyAnimations(sprite, element);
          }
        } catch (error) {
          console.error(`Error displaying asset ${element.assetName}:`, error);
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

    // בדיקת נכסים חסרים
    if (missingAssets.length > 0) {
      summary.push("Missing assets:");
      missingAssets.forEach((asset) => summary.push(`- ${asset}`));
    }

    // סה"כ נכסים טעונים
    summary.push(`Total assets loaded: ${loadedAssets.length}`);

    // סוגי נכסים
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

    // נכסים טעונים
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

    // בדיקה שה-timelineService קיים
    if (!this.timelineService) {
      console.error("Timeline service is not initialized");
      return [
        "Error: Timeline service not initialized",
        `Total timeline elements: ${elements.length}`,
      ];
    }

    // קבלת מפת האסטים מה-AssetService ישירות
    const assetsMap = this.assetService.getAssetsMap();

    // הדפסת המפה של האסטים
    console.log("Assets Map:", Array.from(assetsMap.entries()));

    // הדפסת כל האלמנטים מהטיימליין
    console.log("Timeline Elements:", elements);

    // בדיקת התאמה בין האלמנטים לאסטים
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
      // summary.push("\nValid Timeline elements:");
      validElements.forEach((element, index) => {
        summary.push(
          `${index + 1}. ${element.assetName} (${element.assetType})`
        );
      });
    }

    if (invalidElements.length > 0) {
      // summary.push("\nInvalid Timeline elements:");
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
