import { Scene } from "phaser";
import { AssetService } from "../core/services/AssetService";
import { AnimationService } from "../core/services/AnimationService";
import {
  TimelineJson,
  TimelineElement,
} from "../types/interfaces/TimelineInterfaces";

export class VideoEngine {
  private scene: Scene;
  private assetService: AssetService;
  private animationService: AnimationService;
  private timelineData: TimelineJson | null = null;

  constructor(scene: Scene, assetService: AssetService) {
    this.scene = scene;
    this.assetService = assetService;
    this.animationService = new AnimationService(scene);
    this.setupScene();
  }

  private setupScene(): void {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
  }

  public async loadTimeline(timeline: TimelineJson): Promise<void> {
    console.log("Loading timeline:", timeline);
    this.timelineData = timeline;
    await this.loadAssets();
    await this.initializeElements();
  }

  private async loadAssets(): Promise<void> {
    if (!this.timelineData) return;

    const assetsToLoad = this.timelineData["template video json"]
      .map((element) => element.assetName)
      .filter(Boolean);

    console.log("Loading assets:", assetsToLoad);

    try {
      await Promise.all(
        assetsToLoad.map((assetName) => this.assetService.loadAsset(assetName))
      );
      console.log("Assets loaded successfully");
    } catch (error) {
      console.error("Failed to load assets:", error);
      throw error;
    }
  }

  private async initializeElements(): Promise<void> {
    if (!this.timelineData) return;

    for (const element of this.timelineData["template video json"]) {
      if (element.initialState) {
        const initialProperties = {
          x: element.initialState.position?.x ?? 0,
          y: element.initialState.position?.y ?? 0,
          z: element.initialState.position?.z ?? 0, // להוסיף ברירת מחדל
          scale: element.initialState.scale?.x ?? 1,
          alpha: element.initialState.opacity ?? 1,
        };

        try {
          // יצירת הספרייט עם המצב ההתחלתי
          const sprite = this.assetService.displayAsset(
            element.assetName,
            initialProperties
          );

          // הפעלת האנימציות על הספרייט
          this.animationService.applyAnimations(element, sprite);

          console.log(`${element.assetName} initialized and animated`);
        } catch (error) {
          console.error(`Failed to initialize ${element.assetName}:`, error);
        }
      }
    }
  }

  public async animate(): Promise<void> {
    // אין צורך בלוגיקה נוספת כי האנימציות כבר מופעלות דרך Phaser Tweens
    console.log("Animations started via Phaser Tweens");
  }

  public cleanup(): void {
    this.timelineData = null;
    this.assetService.hideAllAssets();
  }
}
