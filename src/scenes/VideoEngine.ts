import { Scene } from "phaser";
import { AssetService } from "../core/services/AssetService";
import { AnimationService } from "../core/services/AnimationService";
import { CountdownTimer } from "../ui/CountdownTimer/CountdownTimer";
import { TimelineJson } from "../types/interfaces/TimelineInterfaces";
import {
  AssetElement,
  AssetDisplayProperties,
  AssetJson,
} from "../types/interfaces/AssetInterfaces";

export class VideoEngine {
  private scene: Scene;
  private assetService: AssetService;
  private animationService: AnimationService;
  private timelineData: TimelineJson | null = null;
  private assetsData: AssetJson | null = null;
  private activeSprites: Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Video
  > = new Map();
  private countdownTimer: CountdownTimer | null = null;

  constructor(scene: Scene, assetService: AssetService) {
    this.scene = scene;
    this.assetService = assetService;
    this.animationService = new AnimationService(scene);
    this.setupScene();
  }

  public async loadTimelineWithDelay(timeline: TimelineJson): Promise<void> {
    try {
      console.log("++ VideoEngine: Starting loadTimelineWithDelay");

      // נקה מצב קודם
      this.cleanup();

      // שמור את הדאטה
      this.timelineData = timeline;

      console.log("++ VideoEngine: Loading assets");
      // טען את הנכסים למערכת (בלי להציג אותם)
      await this.loadAssets();

      // הדפסת מצב האסטים
      const assetsMap = this.assetService.getAssetsMap();
      console.log("++ Available Assets:", Array.from(assetsMap.keys()));
      assetsMap.forEach((asset, name) => {
        console.log(`++ Asset ${name}:`, asset);
      });

      console.log("++ VideoEngine: Starting countdown timer");
      // הפעל טיימר
      this.countdownTimer = new CountdownTimer(this.scene);
      await this.countdownTimer.start();

      console.log("++ VideoEngine: Initializing timeline elements");
      // רק אחרי שהטיימר סיים, נציג את האלמנטים ונפעיל אנימציות
      await this.initializeTimelineElements();

      console.log("++ VideoEngine: Starting animations");
      this.startAnimations();

      console.log(
        "++ VideoEngine: loadTimelineWithDelay completed successfully"
      );
    } catch (error) {
      console.error("Error loading timeline:", error);
      if (this.countdownTimer) {
        this.countdownTimer.destroy();
      }
    }
  }

  // בתוך VideoEngine.ts
  private async loadAssets(): Promise<void> {
    if (!this.timelineData) return;

    const assetsToLoad = this.timelineData["template video json"]
      .map((element) => element.assetName)
      .filter(Boolean);

    console.log("Assets to load:", assetsToLoad);

    try {
      const loadResults = await Promise.all(
        assetsToLoad.map(async (assetName) => {
          const result = await this.assetService.loadAsset(assetName);
          return { assetName, result };
        })
      );

      loadResults.forEach(({ assetName, result }) => {
        console.log(`Asset ${assetName} load result:`, result);
      });

      // בדיקה שכל האסטים נטענו
      const allLoaded = loadResults.every(({ result }) => result.success);
      if (!allLoaded) {
        console.error("Not all assets were loaded successfully");
      }
    } catch (error) {
      console.error("Failed to load assets:", error);
      throw error;
    }
  }

  private async initializeTimelineElements(): Promise<void> {
    if (!this.timelineData) return;

    for (const element of this.timelineData["template video json"]) {
      if (element.initialState) {
        const initialProperties = {
          x: element.initialState.position?.x ?? 0,
          y: element.initialState.position?.y ?? 0,
          scale: element.initialState.scale?.x ?? 1,
          alpha: element.initialState.opacity ?? 1,
          rotation: element.initialState.rotation ?? 0,
          tint: element.initialState.color
            ? parseInt(element.initialState.color)
            : undefined,
        };

        try {
          const sprite = this.assetService.displayAsset(
            element.assetName,
            initialProperties
          );

          if (sprite) {
            // שימוש ב-z מהמצב ההתחלתי
            const zDepth = element.initialState.position?.z ?? 0;

            // הדפסת מידע על השכבה
            console.log(`Element ${element.elementName}:`, {
              type: element.assetType,
              zDepth,
              currentDepth: sprite.depth,
              visible: sprite.visible,
              alpha: sprite.alpha,
              x: sprite.x,
              y: sprite.y,
            });

            sprite.setDepth(zDepth);
            this.activeSprites.set(element.elementName, sprite);
          }
        } catch (error) {
          console.error(`Failed to initialize ${element.assetName}:`, error);
        }
      }
    }
  }

  public async initializeAssetElements(assets: AssetJson): Promise<void> {
    // נקה מצב קודם
    this.cleanup();

    // שמור את הדאטה
    this.assetsData = assets;

    // טעינת הנכסים
    for (const asset of assets.assets) {
      try {
        // טען את הנכס אם הוא עוד לא נטען
        if (!this.assetService.isAssetLoaded(asset.assetName)) {
          await this.assetService.loadAsset(asset.assetName);
        }

        const initialProperties: AssetDisplayProperties = {
          x: 0,
          y: 0,
          scale: asset.scale_override?.x ?? 1,
          alpha: 1,
          anchor: {
            x: 0.5,
            y: 0.5,
          },
        };

        // הוספת aspect ratio אם קיים
        if (asset.aspect_ratio_override) {
          initialProperties.ratio = {
            width: asset.aspect_ratio_override.width,
            height: asset.aspect_ratio_override.height,
          };
        }

        // הוספת pivot אם קיים
        if (asset.pivot_override) {
          initialProperties.pivot = {
            x: asset.pivot_override.x,
            y: asset.pivot_override.y,
          };
        }

        // הצגת הנכס
        // const sprite = this.assetService.displayAsset(
        //   asset.assetName,
        //   initialProperties
        // );
        // if (sprite) {
        //   this.activeSprites.set(asset.assetName, sprite);
        // }
      } catch (error) {
        console.error(`Failed to initialize asset ${asset.assetName}:`, error);
      }
    }
  }

  private setupScene(): void {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);

    // הדפסת מידע על המצלמה
    console.log("Camera position:", {
      x: this.scene.cameras.main.x,
      y: this.scene.cameras.main.y,
      centerX: this.scene.cameras.main.centerX,
      centerY: this.scene.cameras.main.centerY,
      scrollX: this.scene.cameras.main.scrollX,
      scrollY: this.scene.cameras.main.scrollY,
    });
  }

  private startAnimations(): void {
    if (!this.timelineData || !this.assetsData) return;

    this.timelineData["template video json"].forEach((element) => {
      const sprite = this.activeSprites.get(element.elementName);

      // הוספת בדיקה לסוג האובייקט
      if (
        !sprite ||
        !element.timeline ||
        (!(sprite instanceof Phaser.GameObjects.Sprite) &&
          !(sprite instanceof Phaser.GameObjects.Video))
      )
        return;

      // מציאת נתוני הנכס המתאימים
      const assetData = this.assetsData?.assets.find(
        (asset) => asset.assetName === element.assetName
      );

      // העברת שני האובייקטים בנפרד לשירות האנימציה
      this.animationService.applyAnimations(sprite, element, assetData);
    });
  }

  public cleanup(): void {
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
    }
    this.scene.tweens.killAll();
    this.assetService.hideAllAssets();

    // הרס כל הספרייטים
    this.activeSprites.forEach((sprite) => {
      if (sprite instanceof Phaser.GameObjects.Sprite) {
        sprite.destroy();
      } else if (sprite instanceof Phaser.GameObjects.Video) {
        sprite.stop();
        sprite.destroy();
      }
    });

    this.activeSprites.clear();
    this.timelineData = null;
  }
}
