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
    console.log(`miriVideoService: Constructor initialized with scene:`, scene);
    this.syncSystem = new SyncSystem(scene);
    console.log(`miriVideoService: SyncSystem initialized`);
    this.setupScene();
  }

  private setSpineAnimation(
    spineObject: SpineGameObject,
    trackIndex: number,
    animationName: string,
    loop: boolean
  ): void {
    console.log(
      `miriVideoService: setSpineAnimation called for ${spineObject.name} with animation ${animationName}`
    );
    if (spineObject.animationState) {
      spineObject.animationState.setAnimation(trackIndex, animationName, loop);
      console.log(
        `miriVideoService: Animation ${animationName} set via animationState`
      );
      return;
    }

    if (
      spineObject.state &&
      typeof (spineObject.state as any).setAnimation === "function"
    ) {
      (spineObject.state as any).setAnimation(trackIndex, animationName, loop);
      console.log(`miriVideoService: Animation ${animationName} set via state`);
      return;
    }

    console.warn(
      `miriVideoService: Could not set animation ${animationName} - no valid state found`
    );
  }

  private async setupScene(): Promise<void> {
    console.log(`miriVideoService: setupScene started`);
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
    this.scene.cameras.main.setBounds(0, 0, 1920, 1080);
    this.scene.cameras.main.centerOn(960, 540);
    this.scene.cameras.main.setZoom(1); // וידוא זום ברירת מחדל
    console.log(
      `miriVideoService: Camera bounds set to (0, 0, 1920, 1080) and centered at (960, 540)`
    );
    console.log(
      `miriVideoService: Camera position: (${this.scene.cameras.main.scrollX}, ${this.scene.cameras.main.scrollY}), zoom: ${this.scene.cameras.main.zoom}`
    );
    console.log(
      `miriVideoService: Scene dimensions: (${this.scene.scale.width}, ${this.scene.scale.height})`
    );
    console.log(`miriVideoService: setupScene completed`);
  }

  public async loadTimelineWithDelay(file: File): Promise<void> {
    console.log(
      `miriVideoService: loadTimelineWithDelay started with file:`,
      file.name
    );
    try {
      console.log(`miriVideoService: Reading file content`);
      const fileContent = await file.text();
      console.log(`miriVideoService: File content length:`, fileContent.length);
      const timeline = JSON.parse(fileContent) as TimelineJson;
      console.log(`miriVideoService: Parsed timeline JSON:`, timeline);

      console.log(`miriVideoService: Cleaning up existing assets`);
      //this.cleanup(); // מתודה זו מוגדרת במחלקה ולכן אמורה לעבוד
      this.timelineData = timeline;
      console.log(`miriVideoService: Timeline data set:`, this.timelineData);

      console.log(`miriVideoService: Loading timeline assets`);
      await this.loadTimelineAssets();

      console.log(`miriVideoService: Starting countdown timer`);
      this.countdownTimer = new CountdownTimer(this.scene);
      await this.countdownTimer.start();

      console.log(`miriVideoService: Initializing timeline elements`);
      await this.initializeTimelineElements();

      console.log(`miriVideoService: Timeline loaded successfully`);
    } catch (error) {
      console.error(`miriVideoService: Error loading timeline:`, error);
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
        console.log(
          `miriVideoService: Destroying countdown timer due to error`
        );
        this.countdownTimer.destroy();
      }
      throw error;
    }
  }

  private async loadTimelineAssets(): Promise<void> {
    console.log(`miriVideoService: loadTimelineAssets started`);
    if (!this.timelineData) {
      console.log(`miriVideoService: No timeline data available`);
      return;
    }

    const assetsToLoad = this.timelineData["template video json"]
      .map((element) => element.assetName)
      .filter(Boolean);
    console.log(`miriVideoService: Assets to load:`, assetsToLoad);

    const loadResults = await Promise.all(
      assetsToLoad.map(async (assetName) => {
        console.log(`miriVideoService: Loading asset ${assetName}`);
        const result = await this.assetService.loadAsset(assetName);
        console.log(`miriVideoService: Load result for ${assetName}:`, result);
        return { assetName, result };
      })
    );

    const allLoaded = loadResults.every(({ result }) => result.success);
    console.log(`miriVideoService: All assets loaded successfully?`, allLoaded);
    if (!allLoaded) {
      console.error(
        `miriVideoService: Failed assets:`,
        loadResults.filter(({ result }) => !result.success)
      );
    }
    console.log(`miriVideoService: loadTimelineAssets completed`);
  }

  private convertTimelineToAnimations(
    timelineElement: TimelineElement
  ): SequenceItem[] {
    console.log(
      `miriVideoService: convertTimelineToAnimations called for ${timelineElement.elementName}, full data:`,
      timelineElement
    );
    const sequence: SequenceItem[] = [];
    const timeline = timelineElement.timeline;
    console.log(
      `miriVideoService: Timeline data for ${timelineElement.elementName}:`,
      timeline
    );

    let sprite = this.activeSprites.get(timelineElement.elementName);
    console.log(
      `miriVideoService: Found sprite for ${timelineElement.elementName}:`,
      sprite
    );
    if (!sprite) {
      console.warn(
        `miriVideoService: No sprite found for ${timelineElement.elementName}`
      );
      return sequence;
    }

    let targetSprite = sprite;
    if (sprite instanceof Phaser.GameObjects.Container) {
      targetSprite = sprite.getAt(0) as
        | Phaser.GameObjects.Sprite
        | Phaser.GameObjects.Video
        | SpineGameObject;
      console.log(
        `miriVideoService: Using inner sprite for ${timelineElement.elementName}:`,
        targetSprite
      );
    }

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    console.log(
      `miriVideoService: Screen dimensions for animations: (${screenWidth}, ${screenHeight})`
    );

    if (timeline?.position) {
      console.log(
        `miriVideoService: Position animation for ${timelineElement.elementName}:`,
        timeline.position
      );
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
      console.log(
        `miriVideoService: Added position sequence for ${timelineElement.elementName}:`,
        sequence[sequence.length - 1]
      );
    }

    if (timeline?.opacity) {
      console.log(
        `miriVideoService: Opacity animation for ${timelineElement.elementName}:`,
        timeline.opacity
      );
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
      console.log(
        `miriVideoService: Added opacity sequence for ${timelineElement.elementName}:`,
        sequence[sequence.length - 1]
      );
    }

    if (
      targetSprite instanceof Phaser.GameObjects.Sprite ||
      targetSprite instanceof Phaser.GameObjects.Video ||
      targetSprite instanceof SpineGameObject
    ) {
      if (timeline?.scale) {
        console.log(
          `miriVideoService: Scale animation for ${timelineElement.elementName}:`,
          timeline.scale
        );
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
        console.log(
          `miriVideoService: Added scale sequence for ${timelineElement.elementName}:`,
          sequence[sequence.length - 1]
        );
      }
    }

    if (
      targetSprite instanceof Phaser.GameObjects.Sprite ||
      targetSprite instanceof SpineGameObject
    ) {
      if (timeline?.rotation) {
        console.log(
          `miriVideoService: Rotation animation for ${timelineElement.elementName}:`,
          timeline.rotation
        );
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
        console.log(
          `miriVideoService: Added rotation sequence for ${timelineElement.elementName}:`,
          sequence[sequence.length - 1]
        );
      }

      if (timeline?.color) {
        console.log(
          `miriVideoService: Color animation for ${timelineElement.elementName}:`,
          timeline.color
        );
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
        console.log(
          `miriVideoService: Added color sequence for ${timelineElement.elementName}:`,
          sequence[sequence.length - 1]
        );
      }
    }
    console.log(
      `miriVideoService: Generated sequence for ${timelineElement.elementName}:`,
      sequence
    );
    return sequence;
  }

  private async initializeTimelineElements(): Promise<void> {
    console.log(`miriVideoService: initializeTimelineElements started`);
    if (!this.timelineData) {
      console.log(`miriVideoService: No timeline data available`);
      return;
    }

    const syncGroups: SyncGroup[] = [];
    console.log(
      `miriVideoService: Starting initialization with timelineData:`,
      this.timelineData
    );

    const activeElements = new Set<string>();

    for (const element of this.timelineData["template video json"]) {
      if (!element.initialState || !element.assetName) {
        console.log(
          `miriVideoService: Skipping element due to missing initialState or assetName:`,
          element
        );
        continue;
      }

      activeElements.add(element.elementName);

      let sprite = this.activeSprites.get(element.elementName);
      const isExistingSprite = !!sprite;

      if (!sprite) {
        console.log(
          `miriVideoService: Creating new sprite for ${element.elementName}`
        );
        console.log(
          `miriVideoService: Initial state for ${element.elementName}:`,
          element.initialState
        );
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
        console.log(
          `miriVideoService: Created sprite/container for ${element.elementName}:`,
          spriteOrContainer
        );
        sprite = spriteOrContainer;

        sprite.setVisible(true);
        console.log(
          `miriVideoService: Ensured visibility for ${element.elementName} - Sprite visible: ${sprite.visible}`
        );

        this.activeSprites.set(element.elementName, sprite);
        console.log(
          `miriVideoService: Added ${element.elementName} to activeSprites at (${sprite.x}, ${sprite.y}), size now:`,
          this.activeSprites.size
        );

        console.log(
          `miriVideoService: Post-creation position for ${element.elementName}: (${sprite.x}, ${sprite.y})`
        );
        console.log(
          `miriVideoService: Sprite displayList after adding to activeSprites:`,
          sprite.displayList ? "Exists" : "Null"
        );
      } else {
        console.log(
          `miriVideoService: Updating existing sprite for ${element.elementName}`
        );
        let targetSprite = sprite;
        if (sprite instanceof Phaser.GameObjects.Container) {
          targetSprite = sprite.getAt(0) as
            | Phaser.GameObjects.Sprite
            | Phaser.GameObjects.Video
            | SpineGameObject;
          console.log(
            `miriVideoService: Existing sprite is Container for ${element.elementName}, using inner sprite:`,
            targetSprite
          );
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
          console.log(
            `miriVideoService: Updated sprite position for ${element.elementName}: (${targetSprite.x}, ${targetSprite.y}), scale: ${targetSprite.scaleX}, alpha: ${targetSprite.alpha}`
          );

          if (targetSprite instanceof Phaser.GameObjects.Sprite) {
            if (element.initialState.rotation !== undefined) {
              targetSprite.setRotation(element.initialState.rotation);
              console.log(
                `miriVideoService: Set sprite rotation for ${element.elementName} to ${element.initialState.rotation}`
              );
            }
            if (element.initialState.color) {
              targetSprite.setTint(parseInt(element.initialState.color));
              console.log(
                `miriVideoService: Set tint for ${element.elementName} to ${element.initialState.color}`
              );
            }
          }

          if (targetSprite instanceof SpineGameObject) {
            if (element.initialState.rotation !== undefined) {
              targetSprite.setRotation(element.initialState.rotation);
              console.log(
                `miriVideoService: Set spine rotation for ${element.elementName} to ${element.initialState.rotation}`
              );
            }

            if (
              element.initialState.animation &&
              targetSprite.skeleton &&
              targetSprite.skeleton.data
            ) {
              try {
                const animationNames =
                  targetSprite.skeleton.data.animations.map((a) => a.name);
                console.log(
                  `miriVideoService: Available animations for ${element.elementName}:`,
                  animationNames
                );

                const animationToPlay = element.initialState.animation;
                if (animationNames.includes(animationToPlay)) {
                  console.log(
                    `miriVideoService: Playing animation ${animationToPlay} for ${element.elementName}`
                  );
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
                  console.log(
                    `miriVideoService: Animation ${animationToPlay} not found, using ${firstAnim} instead for ${element.elementName}`
                  );
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
              } catch (animError) {
                console.error(
                  `miriVideoService: Error setting animation for ${element.elementName}:`,
                  animError
                );
              }
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
        console.log(
          `miriVideoService: Set depth for ${element.elementName} to ${zDepth}`
        );

        if (!isExistingSprite) {
          console.log(
            `miriVideoService: Confirmed ${element.elementName} in activeSprites, size now:`,
            this.activeSprites.size
          );
        }

        if (element.timeline) {
          let animationTarget = sprite;
          if (sprite instanceof Phaser.GameObjects.Container) {
            animationTarget = sprite.getAt(0) as
              | Phaser.GameObjects.Sprite
              | Phaser.GameObjects.Video
              | SpineGameObject;
            console.log(
              `miriVideoService: Using inner sprite for animations of ${element.elementName}:`,
              animationTarget
            );
            console.log(
              `miriVideoService: Container position for ${element.elementName}: (${sprite.x}, ${sprite.y})`
            );
            console.log(
              `miriVideoService: Inner sprite position for ${element.elementName}: (${animationTarget.x}, ${animationTarget.y})`
            );
            console.log(
              `miriVideoService: Absolute position for ${
                element.elementName
              }: (${sprite.x + animationTarget.x}, ${
                sprite.y + animationTarget.y
              })`
            );
          }
          const sequence = this.convertTimelineToAnimations(element);
          syncGroups.push({
            target: animationTarget,
            sequence,
          });
          console.log(
            `miriVideoService: Added sync group for ${element.elementName} with sequence length: ${sequence.length}`
          );
        }
      } else {
        console.warn(
          `miriVideoService: Sprite for ${element.elementName} is not a valid type:`,
          sprite
        );
      }
    }

    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        console.log(
          `miriVideoService: Hiding inactive element: ${elementName}`
        );
        sprite.setVisible(false);
      }
    }

    console.log(
      `miriVideoService: Final activeSprites:`,
      Array.from(this.activeSprites.entries())
    );
    console.log(`miriVideoService: Sync groups to play:`, syncGroups);

    if (syncGroups.length > 0) {
      console.log(`miriVideoService: Playing sync groups`);
      await this.syncSystem.playSync(syncGroups);
      console.log(`miriVideoService: Sync groups playback completed`);
    }
    console.log(`miriVideoService: initializeTimelineElements completed`);
  }

  public pauseAllAnimations(): void {
    console.log(`miriVideoService: pauseAllAnimations called`);
    this.activeSprites.forEach((sprite, name) => {
      console.log(`miriVideoService: Pausing animations for ${name}`);
      this.syncSystem.pauseAll([sprite]);
    });
  }

  public resumeAllAnimations(): void {
    console.log(`miriVideoService: resumeAllAnimations called`);
    this.activeSprites.forEach((sprite, name) => {
      console.log(`miriVideoService: Resuming animations for ${name}`);
      this.syncSystem.resumeAll([sprite]);
    });
  }

  public stopAllAnimations(): void {
    console.log(`miriVideoService: stopAllAnimations called`);
    this.activeSprites.forEach((sprite, name) => {
      console.log(`miriVideoService: Stopping animations for ${name}`);
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
    console.log(
      `miriVideoService: getActiveSprites called, returning activeSprites with size:`,
      this.activeSprites.size
    );
    return new Map(this.activeSprites);
  }
}
