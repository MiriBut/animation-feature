// AudioAnimation.ts - Updated version
import { Scene } from "phaser";
import {
  AnimationConfig,
  IAnimatable,
  AnimatableGameObject,
  AudioConfig,
} from "../types";

export class AudioAnimation implements IAnimatable {
  private scene: Scene;
  private sound: Phaser.Sound.WebAudioSound | undefined;
  currentTween: Phaser.Tweens.Tween | undefined;
  private stopTimer: Phaser.Time.TimerEvent | undefined;

  constructor(scene: Scene, target: AnimatableGameObject) {
    this.scene = scene;
    if (target instanceof Phaser.Sound.WebAudioSound) {
      this.sound = target;
    }
  }

  // AudioAnimation.ts
  async play(config: AnimationConfig | AudioConfig): Promise<void> {
    if (config.property !== "audio") return;
    const audioConfig = config as AudioConfig;

    if (!audioConfig.audioKey) {
      throw new Error("AudioAnimation requires an audioKey");
    }

    // Cancel existing timer if present
    if (this.stopTimer) {
      this.stopTimer.remove();
      this.stopTimer = undefined;
    }

    // Create new sound if needed
    if (!this.sound || this.sound.key !== audioConfig.audioKey) {
      if (this.sound) {
        this.sound.stop();
      }
      this.sound = this.scene.sound.add(
        audioConfig.audioKey
      ) as Phaser.Sound.WebAudioSound;
    }

    console.log(
      `AudioAnimation: Scheduling ${audioConfig.audioKey} - delay: ${audioConfig.delay}ms, duration: ${audioConfig.duration}ms, loop: ${audioConfig.loop}`
    );

    return new Promise((resolve) => {
      this.scene.time.delayedCall(audioConfig.delay || 0, () => {
        if (audioConfig.volume && typeof audioConfig.volume === "object") {
          // Handle volume change
          console.log(
            `AudioAnimation: Adjusting volume for ${audioConfig.audioKey} from ${audioConfig.volume.startValue} to ${audioConfig.volume.endValue}`
          );
          this.currentTween = this.scene.tweens.add({
            targets: this.sound,
            volume: {
              from: audioConfig.volume.startValue,
              to: audioConfig.volume.endValue,
            },
            duration: audioConfig.duration,
            ease: audioConfig.easing || "Linear",
            onComplete: () => {
              console.log(
                `AudioAnimation: Volume change completed for ${audioConfig.audioKey}`
              );
              resolve();
            },
          });
        } else {
          // Handle sound playback
          console.log(
            `AudioAnimation: Playing ${audioConfig.audioKey} at ${this.scene.time.now}ms`
          );

          if (this.sound?.isPlaying) {
            console.log(
              `AudioAnimation: Sound ${audioConfig.audioKey} is already playing, stopping before replay`
            );
            this.sound.stop();
          }

          const shouldLoop =
            audioConfig.loop === true || audioConfig.loop === "true";
          console.log(`AudioAnimation: Setting loop to ${shouldLoop}`);

          this.sound?.play({
            loop: shouldLoop,
            volume:
              typeof audioConfig.volume === "number"
                ? audioConfig.volume
                : this.sound.volume,
          });

          // Always set stop timer if duration is provided, regardless of loop
          if (audioConfig.duration) {
            console.log(
              `AudioAnimation: Setting stop timer for ${audioConfig.duration}ms`
            );
            this.stopTimer = this.scene.time.delayedCall(
              audioConfig.duration,
              () => {
                console.log(
                  `AudioAnimation: Duration complete (${audioConfig.duration}ms), stopping ${audioConfig.audioKey}`
                );
                this.sound?.stop();
                resolve();
              }
            );
          } else {
            // Resolve immediately if no duration
            resolve();
          }
        }
      });
    });
  }

  pause(): void {
    if (this.sound && this.sound.isPlaying) this.sound.pause();
  }

  resume(): void {
    if (this.sound && this.sound.isPaused) this.sound.resume();
  }

  stop(): void {
    if (this.stopTimer) {
      this.stopTimer.remove();
      this.stopTimer = undefined;
    }
    if (this.sound) this.sound.stop();
  }

  reset(): void {
    this.stop();
  }
}
