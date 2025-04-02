// src/core/animation/SequenceSystem.ts
import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";
import { MixBlend } from "@esotericsoftware/spine-core";

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig;
  delay?: number;
}

export class SequenceSystem {
  private animationManager: AnimationManager;
  private activeSpineObjects: WeakMap<SpineGameObject, boolean> = new WeakMap();
  private activeDelayedCalls: Set<Phaser.Time.TimerEvent> = new Set();
  private pendingAnimations: Map<string, boolean> = new Map();
  private scene: Scene;
  private isResetting: boolean = false;
  private isDestroyed: boolean = false;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
    this.scene = scene;

    this.scene.events.once("shutdown", this.onSceneShutdown, this);
    this.scene.events.once("destroy", this.onSceneDestroy, this);
    this.scene.events.on("update", this.checkForDeadObjects, this);
  }

  private checkForDeadObjects(): void {
    if (this.isDestroyed || this.isResetting) return;
  }

  private onSceneShutdown(): void {
    this.clearAllSequences();
    this.scene.events.off("update", this.checkForDeadObjects, this);
  }

  private onSceneDestroy(): void {
    this.isDestroyed = true;
    this.clearAllSequences();
    this.scene.events.off("shutdown", this.onSceneShutdown, this);
    this.scene.events.off("destroy", this.onSceneDestroy, this);
    this.scene.events.off("update", this.checkForDeadObjects, this);
  }

  private isValidGameObject(obj: any): boolean {
    return (
      obj &&
      obj.scene &&
      obj.active !== false &&
      typeof obj.destroy === "function"
    );
  }

  private isValidSpineObject(obj: any): boolean {
    return (
      this.isValidGameObject(obj) &&
      obj instanceof SpineGameObject &&
      !!obj.animationState
    );
  }

  async playSequence(
    target: Phaser.GameObjects.GameObject | Phaser.Sound.BaseSound,
    sequence: SequenceItem[]
  ): Promise<void> {
    console.log("playSequence called with:", sequence);

    if (this.isResetting || this.isDestroyed) {
      console.warn(
        "SequenceSystem: System is resetting or destroyed, ignoring sequence request"
      );
      return;
    }

    if (!target) {
      console.warn(
        "SequenceSystem: Invalid target provided (null or undefined)"
      );
      return;
    }

    if (target instanceof SpineGameObject) {
      if (!this.isValidSpineObject(target)) {
        console.warn("SequenceSystem: Invalid Spine object provided");
        return;
      }
      this.activeSpineObjects.set(target, true);
    }

    const trackMap: Map<string, number> = new Map();
    let nextTrack = 0;

    const promises = sequence.map((item) => {
      return new Promise<void>((resolve) => {
        const delay = item.delay || 0;
        const config = { ...item.config };
        const safeAnimName = (config as AnimationConfig).animationName || "";
        const safeAudioKey = (config as AudioConfig).audioKey || "";

        const animId = `${item.type}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        this.pendingAnimations.set(animId, true);

        const delayedCall = this.scene.time.delayedCall(delay, async () => {
          if (this.isResetting || this.isDestroyed) {
            this.pendingAnimations.delete(animId);
            resolve();
            return;
          }

          this.pendingAnimations.delete(animId);

          try {
            // Spine with layering and blending
            if (target instanceof SpineGameObject && item.type === "spine") {
              if (!safeAnimName) {
                console.warn(
                  "Spine animation requires animationName, skipping"
                );
                resolve();
                return;
              }

              const trackIndex = trackMap.get(safeAnimName) ?? nextTrack++;
              trackMap.set(safeAnimName, trackIndex);

              const shouldLoop =
                "loop" in config &&
                (config.loop === "true" || config.loop === true);

              // Blending: הגדרת מיזוג בין אנימציה קודמת לחדשה
              if (trackIndex > 0) {
                const previousAnim = target.animationState.getCurrent(
                  trackIndex - 1
                );
                if (previousAnim && previousAnim.animation) {
                  target.animationStateData.setMix(
                    previousAnim.animation.name,
                    safeAnimName,
                    0.2
                  ); // mixDuration קבוע
                }
              }

              // הפעלת האנימציה
              target.animationState.setAnimation(
                trackIndex,
                safeAnimName,
                shouldLoop
              );

              // עצירה לאחר duration אם לא בלולאה
              if (config.duration && !shouldLoop) {
                const durationCall = this.scene.time.delayedCall(
                  config.duration,
                  () => {
                    if (this.isValidSpineObject(target)) {
                      target.animationState.setEmptyAnimation(trackIndex, 0);
                    }
                  }
                );
                this.activeDelayedCalls.add(durationCall);
              }

              resolve();
            }
            // Sound with simplified handling
            else if (
              target instanceof Phaser.Sound.BaseSound &&
              item.type === "audio"
            ) {
              // From the third version that handles sound well
              try {
                const shouldLoop =
                  "loop" in config &&
                  (config.loop === "true" || config.loop === true);
                const durationMs = config.duration || 0;
                const volume = (config as AudioConfig).volume;

                // Handle playback for 'play' items
                if (!volume) {
                  if (target.isPlaying) {
                    console.log(
                      `Stopping sound ${safeAudioKey} before replaying`
                    );
                    target.stop();
                  }
                  console.log(
                    `Playing sound${
                      safeAudioKey ? ": " + safeAudioKey : ""
                    } with loop: ${shouldLoop}, duration: ${durationMs}ms`
                  );
                  target.play({
                    loop: shouldLoop,
                  });

                  if (durationMs > 0) {
                    const stopCall = this.scene.time.delayedCall(
                      durationMs,
                      () => {
                        if (target.isPlaying) {
                          console.log(
                            `Stopping sound ${safeAudioKey} after duration ${durationMs}ms`
                          );
                          target.stop();
                        }
                      }
                    );
                    this.activeDelayedCalls.add(stopCall);
                  }
                }
                // Handle volume changes for 'volume' items
                else if (
                  typeof volume === "object" &&
                  "startValue" in volume &&
                  "endValue" in volume
                ) {
                  console.log(
                    `Adjusting volume for ${safeAudioKey} from ${volume.startValue} to ${volume.endValue}`
                  );
                  this.scene.tweens.add({
                    targets: target,
                    volume: {
                      from: volume.startValue,
                      to: volume.endValue,
                    },
                    duration: durationMs,
                    ease: config.easing || "Linear",
                    onComplete: () => {
                      console.log(
                        `Volume change completed for ${safeAudioKey}`
                      );
                    },
                  });
                }
              } catch (err) {
                console.warn(`Failed to process sound ${safeAudioKey}`, err);
              }
              resolve();
            }
            // Regular animations through AnimationManager
            else {
              if (!this.isValidGameObject(target)) {
                console.warn("Target is no longer valid, skipping");
                resolve();
                return;
              }
              await this.animationManager.animate(target, item.type, config);
              resolve();
            }
          } catch (error) {
            console.error(`Error processing ${item.type}:`, error);
            resolve();
          }
        });

        this.activeDelayedCalls.add(delayedCall);
      });
    });

    await Promise.all(promises);
  }

  private safelyStopSpineAnimation(spineObj: SpineGameObject): void {
    if (!this.isValidSpineObject(spineObj)) return;
    try {
      for (let i = 0; i < 10; i++) {
        spineObj.animationState.setEmptyAnimation(i, 0);
      }
    } catch (err) {
      console.warn("Error stopping Spine animation:", err);
    }
  }

  stopSequence(target: Phaser.GameObjects.GameObject): void {
    if (!target) return;
    if (target instanceof SpineGameObject) {
      this.safelyStopSpineAnimation(target);
      this.activeSpineObjects.delete(target);
    }
    this.animationManager.stopAnimations(target);
  }

  pauseSequence(target: Phaser.GameObjects.GameObject): void {
    if (!target) return;
    if (target instanceof SpineGameObject && this.isValidSpineObject(target)) {
      try {
        target.animationState.timeScale = 0;
      } catch (err) {
        console.warn("Error pausing Spine animation:", err);
      }
    }
    this.animationManager.pauseAnimations(target);
  }

  resumeSequence(target: Phaser.GameObjects.GameObject): void {
    if (!target) return;
    if (target instanceof SpineGameObject && this.isValidSpineObject(target)) {
      try {
        target.animationState.timeScale = 1;
      } catch (err) {
        console.warn("Error resuming Spine animation:", err);
      }
    }
    this.animationManager.resumeAnimations(target);
  }

  private cancelAllDelayedCalls(): void {
    const delayedCallsToRemove = Array.from(this.activeDelayedCalls);
    for (const timerEvent of delayedCallsToRemove) {
      try {
        if (
          timerEvent &&
          timerEvent.getProgress &&
          timerEvent.getProgress() < 1
        ) {
          timerEvent.remove(false);
        }
      } catch (err) {
        console.warn("Error removing delayed call:", err);
      }
    }
    this.activeDelayedCalls.clear();
    try {
      if (this.scene && this.scene.time) {
        this.scene.time.removeAllEvents();
      }
    } catch (err) {
      console.warn("Error removing all time events:", err);
    }
  }

  stopAllSequences(): void {
    console.log("SequenceSystem: Stopping all sequences for all objects");
    this.isResetting = true;
    this.cancelAllDelayedCalls();
    this.pendingAnimations.clear();
    this.animationManager.stopAll();
    if (this.scene && !this.isDestroyed) {
      try {
        this.scene.time.delayedCall(200, () => {
          this.isResetting = false;
        });
      } catch (err) {
        console.warn("Error setting reset timer:", err);
        setTimeout(() => {
          this.isResetting = false;
        }, 200);
      }
    }
  }

  clearAllSequences(): void {
    console.log("SequenceSystem: Clearing all sequences");
    this.stopAllSequences();
    this.cancelAllDelayedCalls();
    this.activeSpineObjects = new WeakMap();
    this.pendingAnimations.clear();
  }
}
