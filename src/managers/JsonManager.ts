import { Scene } from "phaser";
import { AssetService } from "../core/services/AssetService";
import { TimelineService } from "../core/services/TimelineService";
import { Helpers } from "../core/utils/Helpers";
import { MessageModal, showMessage } from "../ui/ErrorModal/MessageModal";
import { TimelineJson } from "../types/interfaces/TimelineInterfaces";
import { AssetJson } from "../types/interfaces/AssetInterfaces";
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
    this.animationService = new AnimationService(scene); // הוספת השירות החדש
  }

  public async handleAssetsJson(file: File): Promise<void> {
    try {
      const json = (await Helpers.validateAndParseJson(file)) as AssetJson;
      console.log("Parsed assets JSON:", json);
      await this.assetService.handleAssetsJson(json);

      showMessage({
        isOpen: true,
        type: "success",
        title: "Assets Loaded Successfully",
        messages: ["All assets have been loaded successfully"],
        autoClose: true,
        autoCloseTime: 3000,
      });
    } catch (error) {
      showMessage({
        isOpen: true,
        type: "error",
        title: "Error Loading Assets",
        messages: [
          error instanceof Error ? error.message : "Failed to load assets",
        ],
        autoClose: false,
      });
      console.error("Error in handleAssetsJson:", error);
      throw error;
    }
  }

  public async handleTimelineJson(file: File): Promise<void> {
    try {
      this.resetTimelineState();

      if (!this.timelineService) {
        this.timelineService = new TimelineService(
          this.assetService.getAssetsMap()
        );
      }

      const json = (await Helpers.validateAndParseJson(file)) as TimelineJson;
      const validationErrors = await this.timelineService.validateTimelineJson(
        json
      );

      if (validationErrors.length > 0) {
        showMessage({
          isOpen: true,
          type: "error",
          title: "Timeline Validation Errors",
          messages: validationErrors,
          autoClose: true,
        });
        return;
      }

      this.currentTimelineJson = json;
      this.displayTimelineAssets(json["template video json"]);

      showMessage({
        isOpen: true,
        type: "success",
        title: "Timeline Loaded Successfully",
        messages: [
          `Successfully loaded timeline with ${json["template video json"].length} elements`,
        ],
        autoClose: true,
      });
    } catch (error) {
      Helpers.handleError(error, "Timeline Processing Error");
    }
  }

  private resetTimelineState(): void {
    if (this.currentTimelineJson) {
      this.assetService.hideAllAssets();
      this.currentTimelineJson = null;
    }
  }

  private displayTimelineAssets(timelineElements: any[]): void {
    this.assetService.hideAllAssets();

    timelineElements.forEach((element) => {
      if (element.assetName && element.initialState) {
        const {
          position = { x: 0, y: 0 },
          scale = { x: 1 },
          opacity = 1,
          rotation,
          color = "0xFFFFFF",
        } = element.initialState;

        // try {
        //   const sprite = this.assetService.displayAsset(element.assetName, {
        //     x: position.x,
        //     y: position.y,
        //     scale: scale.x,
        //     alpha: opacity,
        //     rotation,
        //     tint: parseInt(color),
        //   });

        //   if (sprite) {
        //     this.animationService.applyAnimations(element, sprite);
        //   }
        // } catch (error) {
        //   console.error("Error displaying asset:", error);
        // }
      }
    });
  }

  private getTimelineAssets(json: TimelineJson): string[] {
    return Array.from(
      new Set(
        json["template video json"].map((el) => el.assetName).filter(Boolean)
      )
    );
  }

  public async parseTimelineJson(file: File): Promise<TimelineJson | null> {
    try {
      const fileContent = await file.text();
      console.log("Full JSON content:", fileContent); // לוג מלא של תוכן JSON

      const json = JSON.parse(fileContent);

      // בדיקות תקינות מפורטות
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

      // בדוק את המבנה של כל פריט
      const invalidItems = json["template video json"].filter(
        (item) => !item.assetName || !item.assetType
      );

      if (invalidItems.length > 0) {
        console.error("Invalid timeline items:", invalidItems);
        throw new Error("Some timeline items are missing required fields");
      }

      return json as TimelineJson;
    } catch (error) {
      console.error("JSON parsing detailed error:", error);
      throw new Error(
        `Failed to parse timeline JSON: ${(error as Error).message}`
      );
    }
  }

  public getAssetUrl(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.url;
  }

  public getAssetType(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.type;
  }
}
