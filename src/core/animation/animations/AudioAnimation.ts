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

    return new Promise((resolve) => {
      this.scene.time.delayedCall(audioConfig.delay || 0, () => {
        if (audioConfig.volume && typeof audioConfig.volume === "object") {
          this.currentTween = this.scene.tweens.add({
            targets: this.sound,
            volume: {
              from: audioConfig.volume.startValue,
              to: audioConfig.volume.endValue,
            },
            duration: audioConfig.duration,
            ease: audioConfig.easing || "Linear",
            onComplete: () => {
              resolve();
            },
          });
        } else {
          // Handle sound playback

          if (this.sound?.isPlaying) {
            this.sound.stop();
          }

          const shouldLoop =
            audioConfig.loop === true || audioConfig.loop === "true";
          this.sound?.play({
            loop: shouldLoop,
            volume:
              typeof audioConfig.volume === "number"
                ? audioConfig.volume
                : this.sound.volume,
          });

          // Always set stop timer if duration is provided, regardless of loop
          if (audioConfig.duration) {
            this.stopTimer = this.scene.time.delayedCall(
              audioConfig.duration,
              () => {
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
