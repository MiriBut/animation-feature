import { Scene } from "phaser";
import { SyncSystem, SyncGroup } from "../animation/SyncSystem";
import {
  AnimationPropertyType,
  AudioConfig,
  SequenceItem,
} from "../animation/types";
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
    | Phaser.GameObjects.Particles.ParticleEmitter
    | Phaser.Sound.WebAudioSound
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

    console.log("VideoService: Assets to load:", assetsToLoad);

    const loadResults = await Promise.all(
      assetsToLoad.map(async (assetName) => {
        const result = await this.assetService.loadAsset(assetName);
        return { assetName, result };
      })
    );

    const failedAssets = loadResults.filter(({ result }) => !result.success);
    if (failedAssets.length > 0) {
      console.error("VideoService: Failed assets:", failedAssets);
      // כאן אפשר גם להציג התראה למשתמש על אסטים שנכשלו
    }

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

    if (
      timelineElement.assetType === "audio" ||
      timeline?.play ||
      timeline?.volume
    ) {
      // וודא שיש אובייקט אודיו תקין
      if (!(sprite instanceof Phaser.Sound.WebAudioSound)) {
        const audioKey = timelineElement.assetName || "bg_music";
        let sound = this.scene.sound.get(audioKey);
        if (!sound) {
          sound = this.scene.sound.add(audioKey, {
            volume: timelineElement.initialState?.volume || 0.5,
            loop: timelineElement.initialState?.loop === true,
          });
        }
        sprite = sound as Phaser.Sound.WebAudioSound;
        this.activeSprites.set(timelineElement.elementName, sprite);
      }

      // טיפול בהגדרות Play
      if (timeline?.play) {
        timeline.play.forEach((playConfig) => {
          console.log(
            `VideoService: Converting audio play - delay: ${
              playConfig.startTime * 1000
            }ms, duration: ${
              (playConfig.endTime - playConfig.startTime) * 1000
            }ms`
          );
          sequence.push({
            type: "audio",
            config: {
              property: "audio",
              startValue: undefined,
              endValue: undefined,
              easing: "Linear",
              duration: (playConfig.endTime - playConfig.startTime) * 1000,
              delay: playConfig.startTime * 1000,
              audioKey: timelineElement.assetName || "bg_music",
              loop: playConfig.loop === "true",
              stopOnComplete: playConfig.loop !== "true",
            } as AudioConfig,
          });
        });
      }

      // טיפול בהגדרות Volume
      if (timeline?.volume && timeline.volume.length > 0) {
        timeline.volume.forEach((volumeConfig) => {
          sequence.push({
            type: "audio",
            config: {
              property: "audio",
              easing: volumeConfig.easeIn || "Linear",
              duration: (volumeConfig.endTime - volumeConfig.startTime) * 1000,
              delay: volumeConfig.startTime * 1000,
              audioKey: timelineElement.assetName || "bg_music",
              volume: {
                startValue: volumeConfig.startValue,
                endValue: volumeConfig.endValue,
              },
              stopOnComplete: false, // ווליום לא מפסיק את האודיו
            } as AudioConfig,
          });
        });
      }
    }

    if (timeline?.animation) {
      timeline.animation.forEach((anim) => {
        sequence.push({
          type: "spine",
          config: {
            property: "spine",
            duration: (anim.endTime - anim.startTime) * 1000,
            easing: anim.easeIn || "Linear",
            delay: anim.startTime * 1000,
            startValue: undefined,
            endValue: undefined,
            animationName: anim.animationName,
            loop: anim.loop,
          },
        });
      });
    }

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

      // טיפול מיוחד באלמנטי אודיו
      if (element.assetType === "audio") {
        if (!sprite || !(sprite instanceof Phaser.Sound.WebAudioSound)) {
          // בדוק אם האודיו כבר נטען ל-Phaser
          let sound = this.scene.sound.get(element.assetName);
          if (!sound) {
            // אם לא נטען, טען אותו
            sound = this.scene.sound.add(element.assetName, {
              volume: element.initialState?.volume || 0.5,
              loop: element.initialState?.loop === true,
            });
          }
          sprite = sound as Phaser.Sound.WebAudioSound;
          this.activeSprites.set(element.elementName, sprite);
        }
      }
      // טיפול בשאר סוגי האלמנטים
      else if (!sprite) {
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
          },
          element.elementName
        );

        sprite = spriteOrContainer;
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Image ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
        ) {
          sprite.setVisible(true);
        }
        this.activeSprites.set(element.elementName, sprite);
      } else {
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Image ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
        ) {
          const newX = element.initialState.position?.x ?? sprite.x;
          const newY = element.initialState.position?.y ?? sprite.y;
          console.log(
            `VideoService: Updating position for ${element.elementName} to (${newX}, ${newY})`
          );
          sprite.setPosition(newX, newY);
          sprite.setAlpha(element.initialState.opacity ?? sprite.alpha);
          sprite.setScale(element.initialState.scale?.x ?? sprite.scaleX);
          sprite.setVisible(true);

          if (sprite instanceof Phaser.GameObjects.Sprite) {
            if (element.initialState.rotation !== undefined) {
              sprite.setRotation(element.initialState.rotation);
            }
            if (element.initialState.color) {
              sprite.setTint(parseInt(element.initialState.color));
            }
          }
        }
      }

      if (element.timeline) {
        let animationTarget = sprite;
        if (sprite instanceof Phaser.GameObjects.Container) {
          animationTarget = sprite.getAt(0) as
            | Phaser.GameObjects.Sprite
            | Phaser.GameObjects.Video
            | Phaser.GameObjects.Container
            | SpineGameObject
            | Phaser.Sound.WebAudioSound
            | Phaser.GameObjects.Particles.ParticleEmitter;
          console.log(
            `VideoService: Absolute position for ${element.elementName}: (${
              sprite.x + animationTarget.x
            }, ${sprite.y + animationTarget.y})`
          );
        } else {
          console.log(
            "** Timeline for " + element.elementName + ": ",
            JSON.stringify(
              element.timeline,
              (key, value) => {
                if (
                  typeof value === "object" &&
                  value instanceof Phaser.GameObjects.GameObject
                ) {
                  return { name: value.name, type: value.constructor.name };
                }
                return value;
              },
              2
            )
          );
        }

        const sequence = this.convertTimelineToAnimations(element);
        if (sequence.length > 0) {
          syncGroups.push({
            target: animationTarget,
            sequence,
          });
        }
      }

      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Image ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        const zDepth = element.initialState.position?.z ?? 0;
        sprite.setDepth(zDepth);
      }
    }

    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Image ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
        ) {
          sprite.setVisible(false);
        }
      }
    }

    console.log(
      `VideoService: Final activeSprites:`,
      Array.from(this.activeSprites.entries()).map(([name, sprite]) => {
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof Phaser.GameObjects.Container ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter ||
          sprite instanceof SpineGameObject
        ) {
          return [name, { name: sprite.name, type: sprite.constructor.name }];
        }
        if (sprite instanceof Phaser.Sound.WebAudioSound) {
          return [name, { key: sprite.key, type: sprite.constructor.name }];
        }
        // אין צורך בברירת מחדל כי כל הסוגים מכוסים
        throw new Error(`Unexpected sprite type for ${name}`);
      })
    );
    if (syncGroups.length > 0) {
      await this.syncSystem.playSync(syncGroups);
    }
  }

  public pauseAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        this.syncSystem.pauseAll([sprite]); // או resumeAll/stopAll
      }
    });
  }

  public resumeAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        this.syncSystem.resumeAll([sprite]);
      }
    });
  }

  public stopAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        this.syncSystem.stopAll([sprite]);
      }
    });
  }

  public getActiveSprites(): Map<
    string,
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Container
  > {
    const filteredMap = new Map<
      string,
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Video
      | SpineGameObject
      | Phaser.GameObjects.Container
    >();
    this.activeSprites.forEach((sprite, key) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container
      ) {
        filteredMap.set(key, sprite);
      }
    });
    return filteredMap;
  }
}
