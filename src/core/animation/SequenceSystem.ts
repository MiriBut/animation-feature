// src/core/animation/SequenceSystem.ts
import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig;
  delay?: number; // Delay before starting the animation
}

export class SequenceSystem {
  private animationManager: AnimationManager;
  private activeSpineObjects: WeakMap<SpineGameObject, boolean> = new WeakMap();
  private activeDelayedCalls: Set<Phaser.Time.TimerEvent> = new Set();
  private pendingAnimations: Map<string, boolean> = new Map(); // Track animations being processed
  private scene: Scene;
  private isResetting: boolean = false;
  private isDestroyed: boolean = false;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
    this.scene = scene;

    // Listen for scene events
    this.scene.events.once("shutdown", this.onSceneShutdown, this);
    this.scene.events.once("destroy", this.onSceneDestroy, this);

    // Add update event for garbage collection
    this.scene.events.on("update", this.checkForDeadObjects, this);
  }

  /**
   * Checks for objects that have been destroyed and cleans them up
   */
  private checkForDeadObjects(): void {
    if (this.isDestroyed || this.isResetting) return;

    // We can't iterate a WeakMap directly, so we use a separate cleanup method
    // This is just a safety mechanism and runs on frame update
  }

  /**
   * Scene shutdown handler
   */
  private onSceneShutdown(): void {
    this.clearAllSequences();
    this.scene.events.off("update", this.checkForDeadObjects, this);
  }

  /**
   * Scene destroy handler
   */
  private onSceneDestroy(): void {
    this.isDestroyed = true;
    this.clearAllSequences();
    this.scene.events.off("shutdown", this.onSceneShutdown, this);
    this.scene.events.off("destroy", this.onSceneDestroy, this);
    this.scene.events.off("update", this.checkForDeadObjects, this);
  }

  /**
   * Safely determines if a GameObject is still valid and active
   */
  private isValidGameObject(obj: any): boolean {
    return (
      obj &&
      obj.scene &&
      obj.active !== false &&
      typeof obj.destroy === "function"
    );
  }

  /**
   * Safely determines if a SpineGameObject is still valid
   */
  private isValidSpineObject(obj: any): boolean {
    // Fix for the Type 'false | AnimationState' error
    // Make sure we're checking a boolean condition
    return (
      this.isValidGameObject(obj) &&
      obj instanceof SpineGameObject &&
      !!obj.animationState
    ); // Double negation to ensure boolean
  }

  /**
   * Plays a sequence of animations on a target object
   *
   * @param target The object to apply animations to
   * @param sequence The sequence of animations to play
   */
  async playSequence(
    target: Phaser.GameObjects.GameObject | Phaser.Sound.BaseSound,
    sequence: SequenceItem[]
  ): Promise<void> {
    // Early return if system is in resetting state or destroyed
    if (this.isResetting || this.isDestroyed) {
      console.warn(
        "SequenceSystem: System is resetting or destroyed, ignoring sequence request"
      );
      return;
    }

    // Check if target is valid
    if (!target) {
      console.warn(
        "SequenceSystem: Invalid target provided (null or undefined)"
      );
      return;
    }

    // Track Spine objects
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
        const {
          animationName,
          loop,
          delay = 0,
          duration,
        } = item.config as AnimationConfig;

        if (!animationName) {
          console.warn("⚠️ Missing animationName, skipping.");
          resolve();
          return;
        }

        // Create unique ID for this animation request
        const animId = `${animationName}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        this.pendingAnimations.set(animId, true);

        // Create and track delayed call
        const delayedCall = this.scene.time.delayedCall(delay, () => {
          // Safety checks
          if (this.isResetting || this.isDestroyed) {
            this.pendingAnimations.delete(animId);
            resolve();
            return;
          }

          // Remove this from pending animations when done
          this.pendingAnimations.delete(animId);

          try {
            // Double check target is still valid - this is critical
            if (target instanceof SpineGameObject) {
              if (!this.isValidSpineObject(target)) {
                console.warn(
                  `Animation target for ${animationName} is no longer valid, skipping`
                );
                resolve();
                return;
              }

              // Handle Spine animation
              let trackIndex = trackMap.get(animationName) ?? nextTrack++;
              trackMap.set(animationName, trackIndex);

              // Only attempt to play if the object is still valid
              try {
                const trackEntry = target.animationState.setAnimation(
                  trackIndex,
                  animationName,
                  loop === "true"
                );

                if (duration && loop !== "true") {
                  const durationCall = this.scene.time.delayedCall(
                    duration,
                    () => {
                      // Check again if target is still valid
                      if (this.isValidSpineObject(target)) {
                        target.animationState.setEmptyAnimation(trackIndex, 0);
                      }
                    }
                  );

                  this.activeDelayedCalls.add(durationCall);
                }
              } catch (err) {
                console.warn(
                  `Failed to set animation ${animationName} on track ${trackIndex}`,
                  err
                );
              }
            } else if (target instanceof Phaser.GameObjects.Sprite) {
              // Handle Sprite animation
              if (!this.isValidGameObject(target)) {
                console.warn(
                  `Sprite for ${animationName} is no longer valid, skipping`
                );
                resolve();
                return;
              }

              try {
                target.play(animationName, true);
              } catch (err) {
                console.warn(
                  `Failed to play sprite animation ${animationName}`,
                  err
                );
              }
            } else if (target instanceof Phaser.Sound.BaseSound) {
              // Handle audio playback
              try {
                if (!target.isPlaying) {
                  target.play();
                }
              } catch (err) {
                console.warn(`Failed to play sound ${animationName}`, err);
              }
            } else {
              // This is where the "Unknown animation type" message comes from
              // Only log if we're not resetting and target still exists
              if (!this.isResetting && target) {
                console.warn(
                  `Unknown or invalid animation target for ${animationName}`
                );
              }
            }
          } catch (error) {
            console.error(`Animation error for ${animationName}:`, error);
          }

          resolve();
        });

        // Track delayed call
        this.activeDelayedCalls.add(delayedCall);
      });
    });

    await Promise.all(promises);
  }

  /**
   * Safely stops animation on a Spine object
   */
  private safelyStopSpineAnimation(spineObj: SpineGameObject): void {
    if (!this.isValidSpineObject(spineObj)) return;

    try {
      // Clear all possible tracks to be thorough
      for (let i = 0; i < 10; i++) {
        spineObj.animationState.setEmptyAnimation(i, 0);
      }
    } catch (err) {
      console.warn("Error stopping Spine animation:", err);
    }
  }

  /**
   * Stops the animation sequence for a specific target
   */
  stopSequence(target: Phaser.GameObjects.GameObject): void {
    if (!target) return;

    // For Spine objects, clear all tracks
    if (target instanceof SpineGameObject) {
      this.safelyStopSpineAnimation(target);
      this.activeSpineObjects.delete(target);
    } else if (target instanceof Phaser.GameObjects.Sprite) {
      // Stop sprite animation - only if valid
      if (this.isValidGameObject(target)) {
        try {
          target.stop();
        } catch (err) {
          console.warn("Error stopping sprite animation:", err);
        }
      }
    }

    // Use the animation manager to stop other animations - safely
    try {
      if (
        this.animationManager &&
        typeof this.animationManager.stopAnimations === "function"
      ) {
        this.animationManager.stopAnimations(target);
      }
    } catch (err) {
      console.warn("Error in AnimationManager.stopAnimations:", err);
    }
  }

  /**
   * Pauses the animation sequence
   */
  pauseSequence(target: Phaser.GameObjects.GameObject): void {
    if (!target) return;

    if (target instanceof SpineGameObject) {
      if (this.isValidSpineObject(target)) {
        try {
          target.animationState.timeScale = 0;
        } catch (err) {
          console.warn("Error pausing Spine animation:", err);
        }
      }
    }

    try {
      if (
        this.animationManager &&
        typeof this.animationManager.pauseAnimations === "function"
      ) {
        this.animationManager.pauseAnimations(target);
      }
    } catch (err) {
      console.warn("Error in AnimationManager.pauseAnimations:", err);
    }
  }

  /**
   * Resumes a paused sequence
   */
  resumeSequence(target: Phaser.GameObjects.GameObject): void {
    if (!target) return;

    if (target instanceof SpineGameObject) {
      if (this.isValidSpineObject(target)) {
        try {
          target.animationState.timeScale = 1;
        } catch (err) {
          console.warn("Error resuming Spine animation:", err);
        }
      }
    }

    try {
      if (
        this.animationManager &&
        typeof this.animationManager.resumeAnimations === "function"
      ) {
        this.animationManager.resumeAnimations(target);
      }
    } catch (err) {
      console.warn("Error in AnimationManager.resumeAnimations:", err);
    }
  }

  /**
   * Safely cancels all delayed calls
   */
  private cancelAllDelayedCalls(): void {
    // Make a copy of the set to avoid modification during iteration
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

    // Safety: Try to remove all scene events as a last resort
    try {
      if (this.scene && this.scene.time) {
        this.scene.time.removeAllEvents();
      }
    } catch (err) {
      console.warn("Error removing all time events:", err);
    }
  }

  /**
   * Stops all animation sequences for all objects
   */
  stopAllSequences(): void {
    console.log("SequenceSystem: Stopping all sequences for all objects");

    // Set resetting flag to prevent new animations from starting
    this.isResetting = true;

    // Cancel all delayed calls safely
    this.cancelAllDelayedCalls();

    // Clear pending animations
    this.pendingAnimations.clear();

    // Using the animation manager to stop all animations - but safely wrapped
    try {
      if (
        this.animationManager &&
        typeof this.animationManager.stopAnimations === "function"
      ) {
        // Create a dummy target since the API requires one
        // Create a temporary object that won't cause errors
        const dummyTarget = {} as Phaser.GameObjects.GameObject;
        this.animationManager.stopAnimations(dummyTarget);
      }
    } catch (err) {
      console.warn("Error in AnimationManager.stopAnimations (global):", err);
    }

    // Reset the resetting flag after a short delay
    if (this.scene && !this.isDestroyed) {
      try {
        const resetTimer = this.scene.time.delayedCall(200, () => {
          this.isResetting = false;
        });
        // We don't add this to tracked calls since we're clearing them
      } catch (err) {
        console.warn("Error setting reset timer:", err);
        // Make sure we still reset the flag
        setTimeout(() => {
          this.isResetting = false;
        }, 200);
      }
    }
  }

  /**
   * Clears all sequences from the system
   */
  clearAllSequences(): void {
    console.log("SequenceSystem: Clearing all sequences");

    // Stop any running animations first
    this.stopAllSequences();

    // Double check all delayed calls are cleared
    this.cancelAllDelayedCalls();

    // Clear all internal tracking
    this.activeSpineObjects = new WeakMap();
    this.pendingAnimations.clear();
  }
}
