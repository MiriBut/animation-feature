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
    } catch (error) {
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

        try {
          const sprite = this.assetService.displayAsset(element.assetName, {
            x: position.x,
            y: position.y,
            scale: scale.x,
            alpha: opacity,
            rotation,
            tint: parseInt(color),
          });

          if (sprite) {
            this.animationService.applyAnimations(element, sprite);
          }
        } catch (error) {
          console.error("Error displaying asset:", error);
        }
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
    await this.handleTimelineJson(file);
    if (!this.currentTimelineJson) {
      return null;
    }
    //throw new Error("No timeline JSON loaded");

    return this.currentTimelineJson;
  }

  public getAssetUrl(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.url;
  }

  public getAssetType(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.type;
  }
}
