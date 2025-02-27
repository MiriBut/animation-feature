import { Scene } from "phaser";
import { SyncSystem, SyncGroup } from "../animation/SyncSystem";
import { AnimationPropertyType, SequenceItem } from "../animation/types";
import { AssetService } from "./AssetService";
import {
  TimelineElement,
  TimelineJson,
} from "../../types/interfaces/TimelineInterfaces";

import { CountdownTimer } from "../../ui/CountdownTimer/CountdownTimer";
import {
  showMessage,
  createErrorMessage,
  createInfoMessage,
  createSuccessMessage,
} from "../../ui/ErrorModal/MessageModal";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";
import { SpineState } from "@/types/interfaces/AssetInterfaces";

export class VideoService {
  private syncSystem: SyncSystem;
  private timelineData: TimelineJson | null = null;
  private activeSprites: Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Video | SpineGameObject
  > = new Map();
  private countdownTimer: CountdownTimer | null = null;
  testSpine: SpineGameObject | null | undefined;

  constructor(private scene: Scene, private assetService: AssetService) {
    this.syncSystem = new SyncSystem(scene);
    this.setupScene();
  }

  private async setupScene(): Promise<void> {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);

    // קריאה ל-createTestSpine והמתנה לתוצאה
    // try {
    //   this.testSpine = await this.assetService.createTestSpine(
    //     this.scene.scale.width / 2,
    //     this.scene.scale.height / 2
    //   );
    //   if (this.testSpine) {
    //     console.log("Test spine created successfully in setupScene");
    //     // ניתן להוסיף את ה-Spine לתמונה
    //     this.testSpine.setVisible(true);
    //   }
    // } catch (error) {
    //   console.error("Failed to create test spine:", error);
    // }
  }

  public async loadTimelineWithDelay(file: File): Promise<void> {
    try {
      console.log("++ VideoService: Starting loadTimelineWithDelay");

      const fileContent = await file.text();
      const timeline = JSON.parse(fileContent) as TimelineJson;

      // נקה מצב קודם
      this.cleanup();
      this.timelineData = timeline;

      console.log("++ VideoService: Loading assets");
      await this.loadTimelineAssets();

      // הדפסת מצב האסטיםinitializeTimelineElements
      this.debugAssetsState();

      console.log("++ VideoService: Starting countdown timer");
      this.countdownTimer = new CountdownTimer(this.scene);
      await this.countdownTimer.start();

      console.log("++ VideoService: Initializing timeline elements");
      await this.initializeTimelineElements();

      console.log("++ VideoService: Timeline loaded successfully");
    } catch (error) {
      console.error("Error loading timeline:", error);
      showMessage({
        isOpen: true,
        title: "Timeline Loading Error",
        messages: [
          createErrorMessage(
            error instanceof Error ? error.message : String(error)
          ),
        ],
      });

      if (this.countdownTimer) {
        this.countdownTimer.destroy();
      }
      throw error;
    }
  }

  private async loadTimelineAssets(): Promise<void> {
    if (!this.timelineData) return;

    const assetsToLoad = this.timelineData["template video json"]
      .map((element) => element.assetName)
      .filter(Boolean);
    console.log("Assets to load:", assetsToLoad);

    const loadResults = await Promise.all(
      assetsToLoad.map(async (assetName) => {
        const result = await this.assetService.loadAsset(assetName);
        console.log(`Load result for ${assetName}:`, result);
        return { assetName, result };
      })
    );

    const allLoaded = loadResults.every(({ result }) => result.success);
    if (!allLoaded) {
      console.error(
        "Failed assets:",
        loadResults.filter(({ result }) => !result.success)
      );
    }
  }

  private convertTimelineToAnimations(
    timelineElement: TimelineElement
  ): SequenceItem[] {
    console.log(
      `Processing element: ${timelineElement.elementName}, full data:`,
      timelineElement
    );
    const sequence: SequenceItem[] = [];
    const timeline = timelineElement.timeline;
    console.log(`Timeline data:`, timeline);

    const sprite = this.activeSprites.get(timelineElement.elementName);
    console.log(`Found sprite for ${timelineElement.elementName}:`, sprite);
    if (!sprite) {
      console.warn(`No sprite found for ${timelineElement.elementName}`);
      return sequence;
    }

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    if (timeline?.position) {
      console.log(`Position animation:`, timeline.position);
      sequence.push({
        type: "position",
        config: {
          property: "position",
          startValue: {
            x: (timeline.position[0].startValue.x / 1920) * screenWidth,
            y: (timeline.position[0].startValue.y / 1080) * screenHeight,
          },
          endValue: {
            x: (timeline.position[0].endValue.x / 1920) * screenWidth,
            y: (timeline.position[0].endValue.y / 1080) * screenHeight,
          },
          duration:
            (timeline.position[0].endTime - timeline.position[0].startTime) *
            1000,
          easing: timeline.position[0].easeIn || "Linear",
          delay: timeline.position[0].startTime * 1000,
        },
      });
    }

    if (timeline?.opacity) {
      console.log(`Opacity animation:`, timeline.opacity);
      sequence.push({
        type: "opacity",
        config: {
          property: "opacity",
          startValue: timeline.opacity[0].startValue,
          endValue: timeline.opacity[0].endValue,
          duration:
            (timeline.opacity[0].endTime - timeline.opacity[0].startTime) *
            1000,
          easing: timeline.opacity[0].easeIn || "Linear",
          delay: timeline.opacity[0].startTime * 1000,
        },
      });
    }

    // אנימציות שעובדות על ספרייטים, וידאו ו-Spine
    if (
      sprite instanceof Phaser.GameObjects.Sprite ||
      sprite instanceof Phaser.GameObjects.Video ||
      sprite instanceof SpineGameObject
    ) {
      if (timeline?.scale) {
        sequence.push({
          type: "scale",
          config: {
            property: "scale",
            startValue: timeline.scale[0].startValue,
            endValue: timeline.scale[0].endValue,
            duration:
              (timeline.scale[0].endTime - timeline.scale[0].startTime) * 1000,
            easing: timeline.scale[0].easeIn || "Linear",
            delay: timeline.scale[0].startTime * 1000,
          },
        });
      }
    }

    // אנימציות שעובדות על ספרייטים ו-Spine
    if (
      sprite instanceof Phaser.GameObjects.Sprite ||
      sprite instanceof SpineGameObject
    ) {
      if (timeline?.rotation) {
        sequence.push({
          type: "rotation",
          config: {
            property: "rotation",
            startValue: timeline.rotation[0].startValue,
            endValue: timeline.rotation[0].endValue,
            duration:
              (timeline.rotation[0].endTime - timeline.rotation[0].startTime) *
              1000,
            easing: timeline.rotation[0].easeIn || "Linear",
            delay: timeline.rotation[0].startTime * 1000,
          },
        });
      }

      if (timeline?.color) {
        sequence.push({
          type: "color",
          config: {
            property: "color",
            startValue: timeline.color[0].startValue,
            endValue: timeline.color[0].endValue,
            duration:
              (timeline.color[0].endTime - timeline.color[0].startTime) * 1000,
            easing: timeline.color[0].easeIn || "Linear",
            delay: timeline.color[0].startTime * 1000,
          },
        });
      }
    }
    console.log(
      `Generated sequence for ${timelineElement.elementName}:`,
      sequence
    );
    return sequence;
  }

  private async initializeTimelineElements(): Promise<void> {
    if (!this.timelineData) return;

    const syncGroups: SyncGroup[] = [];
    console.log(
      "Starting initialization with timelineData:",
      this.timelineData
    );

    // מיפוי של אלמנטים פעילים כדי לנהל מה להציג ומה להסתיר
    const activeElements = new Set<string>();

    for (const element of this.timelineData["template video json"]) {
      if (!element.initialState || !element.assetName) continue;

      activeElements.add(element.elementName);

      // בדיקה אם האלמנט כבר קיים
      let sprite = this.activeSprites.get(element.elementName);
      const isExistingSprite = !!sprite;

      // אם לא קיים, ננסה ליצור אותו
      if (!sprite) {
        console.log(`Creating new sprite for ${element.elementName}`);
        sprite = this.assetService.displayAsset(element.assetName, {
          x: element.initialState.position?.x ?? 0,
          y: element.initialState.position?.y ?? 0,
          scale: element.initialState.scale?.x ?? 1,
          alpha: element.initialState.opacity ?? 1,
          rotation: element.initialState.rotation ?? 0,
          tint: element.initialState.color
            ? parseInt(element.initialState.color)
            : undefined,
        });
        console.log(`Created sprite for ${element.elementName}:`, sprite);
      }
      // אחרת, נעדכן את המאפיינים שלו
      else {
        console.log(`Updating existing sprite for ${element.elementName}`);

        // הגדרת המיקום והמאפיינים לפי initialState
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject
        ) {
          // עדכון תכונות בסיסיות שיש לכל סוגי האובייקטים
          sprite.setPosition(
            element.initialState.position?.x ?? sprite.x,
            element.initialState.position?.y ?? sprite.y
          );
          sprite.setAlpha(element.initialState.opacity ?? sprite.alpha);
          sprite.setScale(element.initialState.scale?.x ?? sprite.scaleX);
          sprite.setVisible(true);

          // תכונות שיש רק לאובייקטים מסוימים
          if (sprite instanceof Phaser.GameObjects.Sprite) {
            if (element.initialState.rotation !== undefined) {
              sprite.setRotation(element.initialState.rotation);
            }
            if (element.initialState.color) {
              sprite.setTint(parseInt(element.initialState.color));
            }
          }

          // טיפול מיוחד לאובייקטי Spine
          if (sprite instanceof SpineGameObject) {
            if (element.initialState.rotation !== undefined) {
              sprite.setRotation(element.initialState.rotation);
            }

            // הפעלת אנימציה אם צריך
            if (
              element.initialState.animation &&
              sprite.skeleton &&
              sprite.skeleton.data
            ) {
              try {
                const animationNames = sprite.skeleton.data.animations.map(
                  (a) => a.name
                );
                console.log(
                  `Available animations for ${element.elementName}:`,
                  animationNames
                );

                const animationToPlay = element.initialState.animation;
                if (animationNames.includes(animationToPlay)) {
                  console.log(
                    `Playing animation ${animationToPlay} for ${element.elementName}`
                  );
                  if (sprite.animationState) {
                    sprite.animationState.setAnimation(
                      0,
                      animationToPlay,
                      true
                    );
                  } else if (sprite.state && typeof sprite.state === "object") {
                    this.setSpineAnimation(sprite, 0, animationToPlay, true);
                  }
                } else if (animationNames.length > 0) {
                  const firstAnim = animationNames[0];
                  console.log(
                    `Animation ${animationToPlay} not found, using ${firstAnim} instead`
                  );
                  if (sprite.animationState) {
                    sprite.animationState.setAnimation(0, firstAnim, true);
                  } else if (sprite.state) {
                    this.setSpineAnimation(sprite, 0, firstAnim, true);
                  }
                }
              } catch (animError) {
                console.error(
                  `Error setting animation for ${element.elementName}:`,
                  animError
                );
              }
            }
          }
        }
      }

      // וודא שה-sprite הוא מסוג תקף ונקבע את ה-z-depth שלו
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject
      ) {
        const zDepth = element.initialState.position?.z ?? 0;
        sprite.setDepth(zDepth);

        // שמירת האובייקט במפה של אובייקטים פעילים
        this.activeSprites.set(element.elementName, sprite);

        if (!isExistingSprite) {
          console.log(
            `Added ${element.elementName} to activeSprites, size now:`,
            this.activeSprites.size
          );
        }

        // יצירת אנימציות אם יש
        if (element.timeline) {
          syncGroups.push({
            target: sprite,
            sequence: this.convertTimelineToAnimations(element),
          });
        }
      } else {
        console.warn(
          `Sprite for ${element.elementName} is not a valid type:`,
          sprite
        );
      }
    }

    // הסתרת אלמנטים שלא נמצאים ב-timeline הנוכחי
    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        console.log(`Hiding inactive element: ${elementName}`);
        sprite.setVisible(false);
      }
    }

    console.log(
      "Final activeSprites:",
      Array.from(this.activeSprites.entries())
    );
    console.log("Sync groups to play:", syncGroups);

    if (syncGroups.length > 0) {
      await this.syncSystem.playSync(syncGroups);
    }
  }

  private setSpineAnimation(
    spineObject: SpineGameObject,
    trackIndex: number,
    animationName: string,
    loop: boolean
  ): void {
    // נסה קודם עם animationState
    if (spineObject.animationState) {
      spineObject.animationState.setAnimation(trackIndex, animationName, loop);
      return;
    }

    // אם לא, נסה עם state
    if (
      spineObject.state &&
      typeof (spineObject.state as any).setAnimation === "function"
    ) {
      (spineObject.state as any).setAnimation(trackIndex, animationName, loop);
      return;
    }

    console.warn(
      `Could not set animation ${animationName} - no valid state found`
    );
  }

  private debugAssetsState(): void {
    const assetsMap = this.assetService.getAssetsMap();
    const messages: any[] = [];

    // Success Messages Section
    messages.push(createInfoMessage("Success Messages"));

    let index = 1;
    assetsMap.forEach((asset, name) => {
      const isLoaded = this.assetService.isAssetLoaded(name);
      if (isLoaded) {
        // Format the success message with index, name, and type
        const assetDetails = `${index}. ${name} (${asset.type})`;
        messages.push(createSuccessMessage(assetDetails));
        index++;
      }
    });

    // Display the modal
    showMessage({
      isOpen: true,
      title: "Assets Loaded - assets.json",
      messages:
        messages.length > 1
          ? messages
          : [createInfoMessage("No assets loaded.")],
      autoClose: true,
      autoCloseTime: 5000,
    });
  }

  public cleanup(): void {
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
    }

    // עצירת כל האנימציות
    this.stopAllAnimations();

    // הרס כל הספרייטים
    this.activeSprites.forEach((sprite) => {
      if (sprite instanceof Phaser.GameObjects.Video) {
        sprite.stop();
      }
      sprite.destroy();
    });

    this.activeSprites.clear();
    this.timelineData = null;
  }

  public pauseAllAnimations(): void {
    this.activeSprites.forEach((sprite) => {
      this.syncSystem.pauseAll([sprite]);
    });
  }

  public resumeAllAnimations(): void {
    this.activeSprites.forEach((sprite) => {
      this.syncSystem.resumeAll([sprite]);
    });
  }

  public stopAllAnimations(): void {
    this.activeSprites.forEach((sprite) => {
      this.syncSystem.stopAll([sprite]);
    });
  }

  public getActiveSprites(): Map<
    string,
    Phaser.GameObjects.Sprite | Phaser.GameObjects.Video | SpineGameObject
  > {
    return new Map(this.activeSprites);
  }
}
