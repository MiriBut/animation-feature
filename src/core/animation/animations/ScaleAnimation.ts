import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";

export class ScaleAnimation implements IAnimatable {
  private currentTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {}

  async play(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      this.currentTween = this.scene.tweens.add({
        targets: this.target,
        scaleX: config.endValue.x,
        scaleY: config.endValue.y,
        duration: config.duration,
        ease: config.easing,
        delay: config.delay || 0,
        onComplete: () => resolve(),
      });
    });
  }

  pause(): void {
    this.currentTween?.pause();
  }

  resume(): void {
    this.currentTween?.resume();
  }

  stop(): void {
    this.currentTween?.stop();
  }

  reset(): void {
    this.stop();
    if ("setScale" in this.target) {
      this.target.setScale(1, 1);
    }
  }
}
