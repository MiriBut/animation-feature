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

  /**
   * הגדרת סצנה ראשונית
   */
  private setupScene(): void {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
  }

  /**
   * טעינת טיימליין חדש
   */
  public async loadTimeline(timeline: TimelineJson): Promise<void> {
    console.log("Loading timeline:", timeline);
    this.timelineData = timeline;
    await this.loadAssets();
    await this.initializeElements();
  }

  /**
   * טעינת כל הנכסים הנדרשים לטיימליין
   */
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

  /**
   * אתחול האלמנטים על הבמה
   */
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
          rotation: element.initialState.rotation,
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

          // הפעלת האנימציות
          this.animationService.applyAnimations(element, sprite);

          console.log(`${element.assetName} initialized and animated`);
        } catch (error) {
          console.error(`Failed to initialize ${element.assetName}:`, error);
        }
      }
    }
  }

  /**
   * התחלת האנימציה
   */
  public async animate(): Promise<void> {
    console.log("Animations started via Phaser Tweens");
  }

  /**
   * חישוב משך הוידאו הכולל
   */
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

  /**
   * ניקוי המצב הנוכחי
   */
  public cleanup(): void {
    this.timelineData = null;
    this.assetService.hideAllAssets();
  }

  /**
   * קבלת מידע על מצב הנוכחי של המנוע
   */
  public getEngineState(): {
    isTimelineLoaded: boolean;
    totalDuration: number;
    activeElements: string[];
  } {
    const activeElements = this.timelineData
      ? this.timelineData["template video json"].map(
          (element) => element.elementName
        )
      : [];

    return {
      isTimelineLoaded: this.timelineData !== null,
      totalDuration: this.calculateTotalDuration(),
      activeElements,
    };
  }

  /**
   * עצירת כל האנימציות
   */
  public stopAllAnimations(): void {
    this.scene.tweens.getTweens().forEach((tween: Phaser.Tweens.Tween) => {
      tween.stop();
    });
  }

  /**
   * השהיית כל האנימציות
   */
  public pauseAllAnimations(): void {
    this.scene.tweens.getTweens().forEach((tween: Phaser.Tweens.Tween) => {
      tween.pause();
    });
  }

  /**
   * המשך האנימציות מהנקודה שנעצרו
   */
  public resumeAllAnimations(): void {
    this.scene.tweens.getTweens().forEach((tween: Phaser.Tweens.Tween) => {
      tween.resume();
    });
  }
}
