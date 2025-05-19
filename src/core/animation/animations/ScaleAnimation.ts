import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";

export class ScaleAnimation implements IAnimatable {
  private currentTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {}

  async play(config: AnimationConfig): Promise<void> {
    // Create a simple sprite to test scaling behavior
    // const sprite = this.scene.add.sprite(400, 300, "testSprite"); // Replace 'testSprite' with your texture
    // sprite.setOrigin(0.5, 0.5); // Ensure origin is centered

    // // Create a tween to test negative scaleX
    // this.scene.tweens.add({
    //   targets: sprite,
    //   scaleX: -1, // Flip horizontally
    //   scaleY: 1, // No change in Y
    //   duration: 1000,
    //   ease: "Linear",
    //   onComplete: () => {
    //     console.log("Tween complete", sprite.scaleX, sprite.scaleY);
    //   },
    // });

    console.log(config.endValue.x + " gfgf " + config.endValue.y);
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
