import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";
import { AnimatableGameObject, AnimationConfig, IAnimatable } from "../types";

export class VisibilityAnimation implements IAnimatable {
  private currentTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {}

  async play(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      // Check if target supports setVisible
      if (
        this.target instanceof Phaser.GameObjects.Sprite ||
        this.target instanceof Phaser.GameObjects.Video ||
        this.target instanceof Phaser.GameObjects.Text ||
        this.target instanceof Phaser.GameObjects.Particles.ParticleEmitter ||
        this.target instanceof Phaser.GameObjects.Container ||
        this.target instanceof SpineGameObject ||
        (this.target as any).setVisible // For SpineGameObject or other custom types
      ) {
        // Set visibility immediately to endValue or startValue or true
        const finalValue = config.endValue ?? config.startValue ?? true;
        (this.target as any).setVisible(finalValue);
        resolve();
      } else {
        resolve(); // Skip for non-visual objects like WebAudioSound
      }
    });
  }

  pause(): void {
    // No-op since there's no tween
  }

  resume(): void {
    // No-op since there's no tween
  }

  stop(): void {
    if (this.currentTween) {
      this.currentTween.stop();
      this.currentTween = undefined;
    }
  }

  reset(): void {
    this.stop();
    if (
      this.target instanceof Phaser.GameObjects.Sprite ||
      this.target instanceof Phaser.GameObjects.Video ||
      this.target instanceof Phaser.GameObjects.Text ||
      this.target instanceof Phaser.GameObjects.Particles.ParticleEmitter ||
      this.target instanceof Phaser.GameObjects.Container ||
      (this.target as any).setVisible
    ) {
      (this.target as any).setVisible(true); // Default to visible
    }
  }
}
