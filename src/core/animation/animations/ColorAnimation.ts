import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";

export class ColorAnimation implements IAnimatable {
  private currentTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {}

  async play(config: AnimationConfig): Promise<void> {
    if (!("setTint" in this.target)) {
      console.warn("Target does not support tint");
      return;
    }

    const startColor =
      typeof config.startValue === "string"
        ? parseInt(config.startValue.replace("0x", ""), 16)
        : config.startValue;

    const endColor =
      typeof config.endValue === "string"
        ? parseInt(config.endValue.replace("0x", ""), 16)
        : config.endValue;

    return new Promise((resolve) => {
      this.currentTween = this.scene.tweens.add({
        targets: {},
        progress: { from: 0, to: 1 },
        duration: config.duration,
        ease: config.easing,
        delay: config.delay || 0,
        onUpdate: (tween) => {
          const progress = tween.getValue();
          const currentColor = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(startColor),
            Phaser.Display.Color.ValueToColor(endColor),
            100,
            progress * 100
          );

          const sprite = this.target as Phaser.GameObjects.Sprite;
          sprite.setTint(
            Phaser.Display.Color.GetColor(
              currentColor.r,
              currentColor.g,
              currentColor.b
            )
          );
        },
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
    const sprite = this.target as Phaser.GameObjects.Sprite;
    if ("clearTint" in sprite) {
      sprite.clearTint();
    }
  }
}
