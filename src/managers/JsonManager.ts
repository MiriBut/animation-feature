import { Scene } from "phaser";
import { AssetService } from "../JsonModal/AssetService";
import { TimelineService } from "../JsonModal/TimelineService";
import { Helpers } from "../JsonModal/Helpers";
import { MessageModal, showMessage } from "../ui/ErrorModal/MessageModal";
import { AssetJson, TimelineJson } from "../JsonModal/Interfaces";

export class JsonManager {
  private scene: Scene;
  private assetService: AssetService;
  private timelineService: TimelineService | null = null;
  private currentTimelineJson: TimelineJson | null = null;
  private messageModal: MessageModal | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.assetService = new AssetService(scene);
  }

  public async handleAssetsJson(file: File): Promise<void> {
    try {
      const json = (await Helpers.validateAndParseJson(file)) as AssetJson;
      await this.assetService.handleAssetsJson(json);
      this.timelineService = new TimelineService(
        this.assetService.getAssetsMap()
      );

      showMessage({
        isOpen: true,
        type: "success",
        title: "Assets Loaded Successfully",
        messages: [`Successfully loaded ${json.assets.length} assets`],
        autoClose: true,
      });
    } catch (error) {
      Helpers.handleError(error, "Asset Processing Error");
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
        } = element.initialState;
        this.assetService.displayAsset(element.assetName, {
          x: position.x,
          y: position.y,
          scale: scale.x,
          alpha: opacity,
          rotation,
        });
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

  public async parseTimelineJson(file: File): Promise<TimelineJson> {
    await this.handleTimelineJson(file);
    if (!this.currentTimelineJson) {
      throw new Error("No timeline JSON loaded");
    }
    return this.currentTimelineJson;
  }

  public getAssetUrl(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.url;
  }

  public getAssetType(assetName: string): string | undefined {
    return this.assetService.getAssetInfo(assetName)?.type;
  }
}
