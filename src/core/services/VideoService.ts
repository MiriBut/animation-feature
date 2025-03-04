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
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Container
  > = new Map();
  private countdownTimer: CountdownTimer | null = null;
  testSpine: SpineGameObject | null | undefined;

  constructor(private scene: Scene, private assetService: AssetService) {
    this.syncSystem = new SyncSystem(scene);
    this.setupScene();
  }

  private setSpineAnimation(
    spineObject: SpineGameObject,
    trackIndex: number,
    animationName: string,
    loop: boolean
  ): void {
    if (spineObject.animationState) {
      spineObject.animationState.setAnimation(trackIndex, animationName, loop);
      return;
    }

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

  private async setupScene(): Promise<void> {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
    this.scene.cameras.main.setBounds(0, 0, 1920, 1080);
    this.scene.cameras.main.centerOn(960, 540);
    this.scene.cameras.main.setZoom(1);
  }

  public async loadTimelineWithDelay(file: File): Promise<void> {
    try {
      const fileContent = await file.text();
      const timeline = JSON.parse(fileContent) as TimelineJson;

      //this.cleanup(); // מתודה זו מוגדרת במחלקה ולכן אמורה לעבוד
      this.timelineData = timeline;

      await this.loadTimelineAssets();

      this.countdownTimer = new CountdownTimer(this.scene);
      await this.countdownTimer.start();

      await this.initializeTimelineElements();
    } catch (error) {
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
    if (!this.timelineData) {
      return;
    }

    const assetsToLoad = this.timelineData["template video json"]
      .map((element) => element.assetName)
      .filter(Boolean);

    const loadResults = await Promise.all(
      assetsToLoad.map(async (assetName) => {
        const result = await this.assetService.loadAsset(assetName);
        return { assetName, result };
      })
    );

    const allLoaded = loadResults.every(({ result }) => result.success);
    if (!allLoaded) {
      console.error(
        `VideoService: Failed assets:`,
        loadResults.filter(({ result }) => !result.success)
      );
    }
  }

  private convertTimelineToAnimations(
    timelineElement: TimelineElement
  ): SequenceItem[] {
    const sequence: SequenceItem[] = [];
    const timeline = timelineElement.timeline;

    let sprite = this.activeSprites.get(timelineElement.elementName);

    if (!sprite) {
      return sequence;
    }

    let targetSprite = sprite;
    if (sprite instanceof Phaser.GameObjects.Container) {
      targetSprite = sprite.getAt(0) as
        | Phaser.GameObjects.Sprite
        | Phaser.GameObjects.Video
        | SpineGameObject;
    }

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    if (timeline?.position) {
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

    if (
      targetSprite instanceof Phaser.GameObjects.Sprite ||
      targetSprite instanceof Phaser.GameObjects.Video ||
      targetSprite instanceof SpineGameObject
    ) {
      if (timeline?.scale) {
        sequence.push({
          type: "scale",
          config: {
            property: "scale",
            startValue: {
              x: timeline.scale[0].startValue.x,
              y: timeline.scale[0].startValue.y,
            },
            endValue: {
              x: timeline.scale[0].endValue.x,
              y: timeline.scale[0].endValue.y,
            },
            duration:
              (timeline.scale[0].endTime - timeline.scale[0].startTime) * 1000,
            easing: timeline.scale[0].easeIn || "Linear",
            delay: timeline.scale[0].startTime * 1000,
          },
        });
      }
    }

    if (
      targetSprite instanceof Phaser.GameObjects.Sprite ||
      targetSprite instanceof SpineGameObject
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

    return sequence;
  }

  public handleResolutionChange(): void {
    this.initializeTimelineElements();
  }

  private async initializeTimelineElements(): Promise<void> {
    if (!this.timelineData) {
      return;
    }
    const syncGroups: SyncGroup[] = [];
    const activeElements = new Set<string>();

    for (const element of this.timelineData["template video json"]) {
      if (!element.initialState || !element.assetName) {
        continue;
      }

      activeElements.add(element.elementName);

      let sprite = this.activeSprites.get(element.elementName);
      const isExistingSprite = !!sprite;

      if (!sprite) {
        const spriteOrContainer = this.assetService.displayAsset(
          element.assetName,
          {
            x: element.initialState.position?.x ?? 0,
            y: element.initialState.position?.y ?? 0,
            scale: element.initialState.scale?.x ?? 1,
            alpha: element.initialState.opacity ?? 1,
            rotation: element.initialState.rotation ?? 0,
            tint: element.initialState.color
              ? parseInt(element.initialState.color)
              : undefined,
          }
        );

        sprite = spriteOrContainer;
        sprite.setVisible(true);
        this.activeSprites.set(element.elementName, sprite);
      } else {
        let targetSprite = sprite;
        if (sprite instanceof Phaser.GameObjects.Container) {
          targetSprite = sprite.getAt(0) as
            | Phaser.GameObjects.Sprite
            | Phaser.GameObjects.Video
            | SpineGameObject;
        }

        if (
          targetSprite instanceof Phaser.GameObjects.Sprite ||
          targetSprite instanceof Phaser.GameObjects.Video ||
          targetSprite instanceof SpineGameObject
        ) {
          const newX = element.initialState.position?.x ?? targetSprite.x;
          const newY = element.initialState.position?.y ?? targetSprite.y;
          console.log(
            `miriVideoService: Updating position for ${element.elementName} to (${newX}, ${newY})`
          );
          targetSprite.setPosition(newX, newY);
          targetSprite.setAlpha(
            element.initialState.opacity ?? targetSprite.alpha
          );
          targetSprite.setScale(
            element.initialState.scale?.x ?? targetSprite.scaleX
          );
          targetSprite.setVisible(true);

          if (targetSprite instanceof Phaser.GameObjects.Sprite) {
            if (element.initialState.rotation !== undefined) {
              targetSprite.setRotation(element.initialState.rotation);
            }
            if (element.initialState.color) {
              targetSprite.setTint(parseInt(element.initialState.color));
            }
          }

          if (targetSprite instanceof SpineGameObject) {
            if (element.initialState.rotation !== undefined) {
              targetSprite.setRotation(element.initialState.rotation);
            }

            if (
              element.initialState.animation &&
              targetSprite.skeleton &&
              targetSprite.skeleton.data
            ) {
              try {
                const animationNames =
                  targetSprite.skeleton.data.animations.map((a) => a.name);

                const animationToPlay = element.initialState.animation;
                if (animationNames.includes(animationToPlay)) {
                  if (targetSprite.animationState) {
                    targetSprite.animationState.setAnimation(
                      0,
                      animationToPlay,
                      true
                    );
                  } else if (
                    targetSprite.state &&
                    typeof targetSprite.state === "object"
                  ) {
                    this.setSpineAnimation(
                      targetSprite,
                      0,
                      animationToPlay,
                      true
                    );
                  }
                } else if (animationNames.length > 0) {
                  const firstAnim = animationNames[0];
                  if (targetSprite.animationState) {
                    targetSprite.animationState.setAnimation(
                      0,
                      firstAnim,
                      true
                    );
                  } else if (targetSprite.state) {
                    this.setSpineAnimation(targetSprite, 0, firstAnim, true);
                  }
                }
              } catch (animError) {}
            }
          }
        }
      }

      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof SpineGameObject
      ) {
        const zDepth = element.initialState.position?.z ?? 0;
        sprite.setDepth(zDepth);

        if (!isExistingSprite) {
        }

        if (element.timeline) {
          let animationTarget = sprite;
          if (sprite instanceof Phaser.GameObjects.Container) {
            animationTarget = sprite.getAt(0) as
              | Phaser.GameObjects.Sprite
              | Phaser.GameObjects.Video
              | SpineGameObject;

            console.log(
              `VideoService: Absolute position for ${element.elementName}: (${
                sprite.x + animationTarget.x
              }, ${sprite.y + animationTarget.y})`
            );
          }
          const sequence = this.convertTimelineToAnimations(element);
          syncGroups.push({
            target: animationTarget,
            sequence,
          });
        }
      } else {
        console.warn(
          `VideoService: Sprite for ${element.elementName} is not a valid type:`,
          sprite
        );
      }
    }

    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        sprite.setVisible(false);
      }
    }

    console.log(
      `VideoService: Final activeSprites:`,
      Array.from(this.activeSprites.entries())
    );

    if (syncGroups.length > 0) {
      await this.syncSystem.playSync(syncGroups);
    }
  }

  public pauseAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      this.syncSystem.pauseAll([sprite]);
    });
  }

  public resumeAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      this.syncSystem.resumeAll([sprite]);
    });
  }

  public stopAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      this.syncSystem.stopAll([sprite]);
    });
  }

  public getActiveSprites(): Map<
    string,
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Container
  > {
    return new Map(this.activeSprites);
  }
}
