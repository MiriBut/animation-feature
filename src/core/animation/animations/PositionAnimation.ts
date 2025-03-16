import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";

export class PositionAnimation implements IAnimatable {
  private currentTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {}

  async play(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      this.currentTween = this.scene.tweens.add({
        targets: this.target,
        x: config.endValue.x,
        y: config.endValue.y,
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
    if ("setPosition" in this.target) {
      this.target.setPosition(0, 0);
    }
  }
}
