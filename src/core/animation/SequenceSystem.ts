import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig;
  delay?: number;
}

export class SequenceSystem {
  private animationManager: AnimationManager;
  private activeSpineObjects: Set<SpineGameObject> = new Set();
  private spineTrackMap: Map<string, number> = new Map();
  private spineNextTrack: number = 0;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
  }

  private isSpineObject(obj: any): boolean {
    return obj && obj instanceof SpineGameObject && !!obj.animationState;
  }

  async playSequence(
    target: Phaser.GameObjects.GameObject | Phaser.Sound.WebAudioSound,
    sequence: SequenceItem[]
  ): Promise<void> {
    // sequence.forEach((item) => {
    //   console.log("Playing sequence item:", JSON.stringify(item, null, 2));
    // });

    if (this.isSpineObject(target)) {
      this.activeSpineObjects.add(target as SpineGameObject);
      this.spineTrackMap.clear();
      this.spineNextTrack = 0;
    }

    // Track all animation promises in a single array
    const allPromises: Promise<void>[] = [];

    // Handle Spine animations
    if (this.isSpineObject(target)) {
      const spineTarget = target as SpineGameObject;

      // Process Spine animation items
      sequence
        .filter((item) => item.type === "spine")
        .forEach((item) => {
          const config = { ...item.config } as AnimationConfig & {
            startTime?: number;
            endTime?: number;
          };
          const animName = config.animationName || "";
          const startTime = item.delay ?? config.delay ?? config.startTime ?? 0;
          const endTime = config.endTime ?? Infinity;
          const shouldLoop = config.loop === "true";

          if (!animName) {
            console.error("Spine animation requires a valid animationName");
            return;
          }

          // Calculate duration from endTime - startTime if both are provided
          const calculatedDuration =
            endTime !== Infinity && endTime > startTime
              ? endTime - startTime
              : config.duration;

          const promise = new Promise<void>((resolve) => {
            setTimeout(() => {
              try {
                if (!spineTarget.animationState) {
                  console.error(
                    "Spine object has no animationState:",
                    spineTarget
                  );
                  resolve();
                  return;
                }

                const trackIndex = this.spineNextTrack++;
                this.spineTrackMap.set(animName, trackIndex);

                // Check for overlap with previous animation for blending
                if (trackIndex > 0) {
                  const previousAnim = spineTarget.animationState.getCurrent(
                    trackIndex - 1
                  );
                  if (
                    previousAnim?.animation &&
                    previousAnim.animationEnd * 1000 > startTime // Convert to milliseconds
                  ) {
                    spineTarget.animationStateData.setMix(
                      previousAnim.animation.name,
                      animName,
                      0.2
                    );
                  }
                }

                // Play the animation
                spineTarget.animationState.setAnimation(
                  trackIndex,
                  animName,
                  shouldLoop
                );

                // Stop animation at calculated end time if defined
                if (calculatedDuration) {
                  setTimeout(() => {
                    if (
                      this.activeSpineObjects.has(spineTarget) &&
                      spineTarget.animationState
                    ) {
                      spineTarget.animationState.setEmptyAnimation(
                        trackIndex,
                        0
                      );
                    }
                    resolve();
                  }, calculatedDuration);
                } else {
                  // Resolve immediately if no end time
                  resolve();
                }
              } catch (error) {
                console.error(`Spine animation error for ${animName}:`, error);
                resolve();
              }
            }, startTime);
          });

          allPromises.push(promise);
        });
    }

    // Process ALL non-Spine items in parallel with Spine animations
    sequence
      .filter((item) => item.type !== "spine")
      .forEach((item) => {
        const config = { ...item.config };
        const promise = new Promise<void>((resolve) => {
          const delay = item.delay || config.delay || 0;
          setTimeout(async () => {
            config.delay = 0;
            try {
              await this.animationManager.animate(target, item.type, config);
              resolve();
            } catch (error) {
              console.error(`Animation error for ${item.type}:`, error);
              resolve();
            }
          }, delay);
        });

        allPromises.push(promise);
      });

    // Wait for all animations to complete
    await Promise.all(allPromises);
  }

  stopSequence(target: Phaser.GameObjects.GameObject): void {
    if (this.isSpineObject(target)) {
      const spineObj = target as SpineGameObject;
      try {
        // clean all tracks
        for (let i = 0; i < 10; i++) {
          spineObj.animationState.setEmptyAnimation(i, 0);
        }
        this.activeSpineObjects.delete(spineObj);
      } catch (err) {
        console.warn("Error stopping Spine animation:", err);
      }
    }

    this.animationManager.stopAnimations(target);
  }

  pauseSequence(target: Phaser.GameObjects.GameObject): void {
    if (this.isSpineObject(target)) {
      try {
        (target as SpineGameObject).animationState.timeScale = 0;
      } catch (err) {
        console.warn("Error pausing Spine animation:", err);
      }
    }

    this.animationManager.pauseAnimations(target);
  }

  resumeSequence(target: Phaser.GameObjects.GameObject): void {
    if (this.isSpineObject(target)) {
      try {
        (target as SpineGameObject).animationState.timeScale = 1;
      } catch (err) {
        console.warn("Error resuming Spine animation:", err);
      }
    }

    this.animationManager.resumeAnimations(target);
  }

  stopAllSequences(): void {
    this.activeSpineObjects.forEach((spineObj) => {
      try {
        for (let i = 0; i < 10; i++) {
          spineObj.animationState.setEmptyAnimation(i, 0);
        }
      } catch (err) {
        console.warn("Error stopping Spine animation:", err);
      }
    });
    this.activeSpineObjects.clear();

    this.animationManager.stopAll();
  }

  clearAllSequences(): void {
    this.stopAllSequences();
    this.activeSpineObjects.clear();
    this.spineTrackMap.clear();
    this.spineNextTrack = 0;
  }
}
