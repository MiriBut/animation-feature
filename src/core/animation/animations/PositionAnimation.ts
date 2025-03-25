import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";

export class PositionAnimation implements IAnimatable {
  private currentTween?: Phaser.Tweens.Tween;
  private depthTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {}

  async play(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      // Create position tween
      this.currentTween = this.scene.tweens.add({
        targets: this.target,
        x: config.endValue.x,
        y: config.endValue.y,
        duration: config.duration,
        ease: config.easing,
        delay: config.delay || 0,
      });

      // Create depth tween if z values are present
      if (
        config.startValue.z !== undefined &&
        config.endValue.z !== undefined
      ) {
        const startZ = config.startValue.z;
        const endZ = config.endValue.z;

        // Create a dummy object to tween the z value
        const depthObj = { z: startZ };
        this.depthTween = this.scene.tweens.add({
          targets: depthObj,
          z: endZ,
          duration: config.duration,
          ease: config.easing,
          delay: config.delay || 0,
          onUpdate: () => {
            if ("setDepth" in this.target) {
              this.target.setDepth(depthObj.z);
            }
          },
          onComplete: () => resolve(),
        });
      } else {
        this.currentTween.on("complete", () => resolve());
      }
    });
  }

  pause(): void {
    this.currentTween?.pause();
    this.depthTween?.pause();
  }

  resume(): void {
    this.currentTween?.resume();
    this.depthTween?.resume();
  }

  stop(): void {
    this.currentTween?.stop();
    this.depthTween?.stop();
  }

  reset(): void {
    this.stop();
    if ("setPosition" in this.target) {
      this.target.setPosition(0, 0);
    }
    if ("setDepth" in this.target) {
      this.target.setDepth(0);
    }
  }
}
