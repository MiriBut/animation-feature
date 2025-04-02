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

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
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
    const trackMap: Map<string, number> = new Map(); // Store tracks for Spine only
    let nextTrack = 0; // Next track to use for Spine

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

        setTimeout(async () => {
          try {
            if (target instanceof SpineGameObject) {
              // 🎭 **Spine** → Dynamic track management
              let trackIndex = trackMap.has(animationName)
                ? trackMap.get(animationName)!
                : nextTrack;
              if (!trackMap.has(animationName)) {
                trackMap.set(animationName, trackIndex);
                nextTrack++; // Save new track for next use
              }

              console.log(
                `Spine: Playing ${animationName} on track ${trackIndex}`
              );
              const trackEntry = target.animationState.setAnimation(
                trackIndex,
                animationName,
                loop === "true"
              );

              if (duration && loop !== "true") {
                target.scene.time.delayedCall(duration, () => {
                  target.animationState.setEmptyAnimation(trackIndex, 0);
                  trackMap.delete(animationName);
                });
              }
            } else if (target instanceof Phaser.GameObjects.Sprite) {
              // 🎭 **Regular Phaser** → Use sprite animations
              console.log(`Sprite: Playing ${animationName}`);
              target.play(animationName);
            } else if (target instanceof Phaser.Sound.BaseSound) {
              // 🎭 **Sound** → Play audio file
              console.log(`Sound: Playing ${animationName}`);
              target.play();
            } else {
              console.warn(`Unknown animation type for ${animationName}`);
            }

            resolve();
          } catch (error) {
            console.error(`Animation error for ${animationName}:`, error);
            resolve();
          }
        }, delay);
      });
    });

    await Promise.all(promises);
  }

  /**
   * Stops the animation sequence
   */
  stopSequence(target: Phaser.GameObjects.GameObject): void {
    this.animationManager.stopAnimations(target);
  }

  /**
   * Pauses the animation sequence
   */
  pauseSequence(target: Phaser.GameObjects.GameObject): void {
    this.animationManager.pauseAnimations(target);
  }

  /**
   * Resumes a paused sequence
   */
  resumeSequence(target: Phaser.GameObjects.GameObject): void {
    this.animationManager.resumeAnimations(target);
  }

  /**
   * Stops all animation sequences for all objects
   */
  stopAllSequences(): void {
    console.log("SequenceSystem: Stopping all sequences for all objects");
    // Since we don't have direct access to all objects,
    // we rely on AnimationManager to stop all active animations

    // If you have a list of active targets, you can iterate and stop sequences:
    // this.activeTargets.forEach(target => {
    //   this.stopSequence(target);
    // });
  }

  /**
   * Clears all sequences from the system
   */
  clearAllSequences(): void {
    console.log("SequenceSystem: Clearing all sequences");

    // Here you can clear any internal data structures holding sequence information
    // For example, if you have a map or array of active sequences:
    // this.activeSequences.clear();
  }
}
