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
  private activeSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

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
    this.cleanup(); // נקה מצב קודם
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
          z: element.initialState.position?.z ?? 0,
          scale: element.initialState.scale?.x ?? 1,
          alpha: element.initialState.opacity ?? 1,
          rotation: element.initialState.rotation ?? 0,
          tint: element.initialState.color
            ? parseInt(element.initialState.color)
            : undefined,
        };

        try {
          // יצירת הספרייט
          const sprite = this.assetService.displayAsset(
            element.assetName,
            initialProperties
          );

          if (sprite) {
            this.activeSprites.set(element.elementName, sprite);
          }

          console.log(`${element.assetName} initialized`);
        } catch (error) {
          console.error(`Failed to initialize ${element.assetName}:`, error);
        }
      }
    }
  }

  // שם הפונקציה המקורי - לתאימות לאחור
  public async animate(): Promise<void> {
    this.startAnimations();
  }

  // הפונקציה החדשה - מפעילה את האנימציות
  public startAnimations(): void {
    if (!this.timelineData) return;

    this.timelineData["template video json"].forEach((element) => {
      const sprite = this.activeSprites.get(element.elementName);
      if (sprite && element.timeline) {
        // הפעלת האנימציות על הספרייט
        this.animationService.applyAnimations(sprite, element.timeline);
      }
    });

    console.log("All animations started");
  }

  public calculateTotalDuration(): number {
    if (!this.timelineData) return 0;

    let maxEndTime = 0;

    this.timelineData["template video json"].forEach((element) => {
      if (element.timeline) {
        const animationTypes = [
          "scale",
          "position",
          "color",
          "opacity",
          "rotation",
        ];
        animationTypes.forEach((type) => {
          const animations =
            element.timeline![type as keyof typeof element.timeline];
          if (Array.isArray(animations)) {
            animations.forEach((anim) => {
              maxEndTime = Math.max(maxEndTime, anim.endTime);
            });
          }
        });
      }
    });

    return maxEndTime;
  }

  public cleanup(): void {
    this.stopAllAnimations();
    this.assetService.hideAllAssets();
    this.activeSprites.clear();
    this.timelineData = null;
  }

  public stopAllAnimations(): void {
    this.scene.tweens.killAll();
  }

  public pauseAllAnimations(): void {
    this.scene.tweens.pauseAll();
  }

  public resumeAllAnimations(): void {
    this.scene.tweens.resumeAll();
  }
}
