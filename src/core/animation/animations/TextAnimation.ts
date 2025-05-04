import { Scene } from "phaser";
import { IAnimatable, AnimationConfig, AnimatableGameObject } from "../types";
import { AssetService } from "@/core/services/AssetService";

export class TextAnimation {
  private underlineGraphics: Phaser.GameObjects.Graphics | null = null;
  private updateUnderlineCallback?: () => void;
  private tween?: Phaser.Tweens.Tween;
  private target: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private currentFontSize?: number;
  private currentColor?: string;
  private currentStyle: any = {};
  currentFontWeight: string | undefined;
  private isDestroyed: boolean = false;

  constructor(scene: Phaser.Scene, target: AnimatableGameObject) {
    this.scene = scene;
    this.target = target as Phaser.GameObjects.Text;

    this.scene = scene;
    if (!(target instanceof Phaser.GameObjects.Text)) {
      throw new Error("TextAnimation can only be used with Text objects");
    }
    this.target = target as Phaser.GameObjects.Text;

    const rawFontSize = this.target.style.fontSize;
    this.currentFontSize =
      rawFontSize && /\d+/.test(String(rawFontSize))
        ? parseInt(String(rawFontSize), 10)
        : 32;

    const styleColor = this.target.style.color;
    this.currentColor = typeof styleColor === "string" ? styleColor : "#ffffff";

    this.currentStyle = { ...this.target.style };

    if (this.target.getData("textDecoration") === "underline") {
      this.applyUnderline();
    }
  }

  async play(config: AnimationConfig): Promise<void> {
    if (this.isDestroyed) return;

    if (!this.target || !this.target.active) {
      this.target = this.scene.add.text(
        this.target?.x || 0,
        this.target?.y || 0,
        config.textValue || "",
        {
          fontFamily: this.currentStyle.fontFamily || "Arial",
          fontSize: `${this.currentFontSize || 32}px`,
          color: this.currentColor || "#ffffff",
          fontStyle: this.currentStyle.fontStyle || "normal",
        }
      );
    }

    this.target.setPadding(10, 40, 10, 10);
    this.target.setOrigin(0.5, 0);

    if (config.property !== "text") return;

    if (config.textValue) {
      this.target.setText(config.textValue);
    }
    this.updateFontStyle(config);

    return new Promise((resolve) => {
      const tweenConfig: any = {
        targets: this.target,
        duration: config.duration,
        ease: config.easing || "Linear",
        onComplete: () => {
          resolve();
        },
      };

      if (config.easing) {
        this.target.setAlpha(0);
        tweenConfig.alpha = { from: 0, to: 1 };

        if (this.underlineGraphics) {
          this.underlineGraphics.setAlpha(0);
          this.scene.tweens.add({
            targets: this.underlineGraphics,
            alpha: { from: 0, to: 1 },
            duration: config.duration,
            ease: config.easing,
            delay: config.delay || 0,
          });
        }
      }

      if (config.fontSize && typeof config.fontSize === "object") {
        const startValue = parseInt(
          String(config.fontSize.startValue || this.currentFontSize),
          10
        );
        const endValue = parseInt(String(config.fontSize.endValue), 10);
        tweenConfig.progress = { from: 0, to: 1 };
        tweenConfig.onUpdate = (tween: Phaser.Tweens.Tween) => {
          if (!this.target.active) return;
          const progress = tween.getValue() as number;
          const currentSize = Math.round(
            startValue + (endValue - startValue) * progress
          );
          const newStyle = { ...this.target.style };
          newStyle.fontSize = `${currentSize}px`;
          this.target.setStyle(newStyle);
          if (this.underlineGraphics) {
            this.updateUnderline();
          }
        };
      }

      if (config.color && typeof config.color === "object") {
        const startColor = parseInt(
          config.color.startValue.replace("#", ""),
          16
        );
        const endColor = parseInt(config.color.endValue.replace("#", ""), 16);
        tweenConfig.colorBlend = { from: 0, to: 1 };
        tweenConfig.onUpdate = (tween: Phaser.Tweens.Tween) => {
          if (!this.target.active) return;
          const value = tween.getValue() as number;
          const blendedColor = this.blendColors(startColor, endColor, value);
          this.target.setTint(blendedColor);
          this.currentColor = `#${blendedColor.toString(16).padStart(6, "0")}`;
          if (this.underlineGraphics) {
            this.updateUnderline();
          }
        };
      }

      this.tween = this.scene.tweens.add(tweenConfig);

      // הסר את ההרס האוטומטי של הטקסט
      // this.scene.time.addEvent({
      //   delay: config.duration + (config.delay || 0),
      //   callback: () => {
      //     if (this.tween) {
      //       this.tween.stop();
      //       this.tween = undefined;
      //     }
      //     this.target.destroy();
      //     this.removeUnderline();
      //   },
      //   callbackScope: this,
      //   loop: false,
      // });
    });
  }

  private blendColors(
    startColor: number,
    endColor: number,
    ratio: number
  ): number {
    const r1 = (startColor >> 16) & 0xff;
    const g1 = (startColor >> 8) & 0xff;
    const b1 = startColor & 0xff;

    const r2 = (endColor >> 16) & 0xff;
    const g2 = (endColor >> 8) & 0xff;
    const b2 = endColor & 0xff;

    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);

    return (r << 16) | (g << 8) | b;
  }

  private updateFontStyle(config: AnimationConfig): void {
    if (this.isDestroyed || !this.target.active || !this.target.style) {
      console.warn(
        `Text animation target is no longer valid for ${
          config.assetName || "unknown"
        }`
      );
      return;
    }

    const newStyle: any = { ...this.target.style };

    let fontSizeValue: number;

    if (typeof config.fontSize === "string") {
      fontSizeValue = parseInt(config.fontSize, 10);
    } else if (config.fontSize && "endValue" in config.fontSize) {
      fontSizeValue = parseInt(String(config.fontSize.endValue), 10);
    } else {
      fontSizeValue = this.currentFontSize ?? 32;
    }
    this.currentFontSize = fontSizeValue;

    let fontStyleValue = config.fontStyle || "normal";

    if (config.fontWeight === "bold") {
      fontStyleValue = fontStyleValue === "italic" ? "bold italic" : "bold";
    }

    newStyle.fontFamily = config.fontName || "Arial";
    newStyle.fontSize = `${fontSizeValue}px`;
    newStyle.fontStyle = fontStyleValue;

    this.currentFontWeight = config.fontWeight || "normal";

    if (config.textDecoration) {
      this.currentStyle.textDecoration = config.textDecoration;
      this.target.setData("textDecoration", config.textDecoration);
      if (config.textDecoration === "underline") {
        this.applyUnderline();
      } else if (config.textDecoration === "none") {
        this.removeUnderline();
      }
    }

    this.target.setStyle(newStyle);
  }

  private applyUnderline(): void {
    this.removeUnderline();

    this.underlineGraphics = this.scene.add.graphics();

    this.updateUnderlineCallback = () => {
      if (!this.target.active) return;
      this.updateUnderline();
    };

    this.updateUnderline();
    this.scene.events.on("postupdate", this.updateUnderlineCallback);

    this.target.once("destroy", () => {
      this.removeUnderline();
    });
  }

  private updateUnderline(): void {
    if (!this.underlineGraphics) return;

    this.underlineGraphics.clear();

    const textBounds = this.target.getBounds();

    let colorNum = 0xffffff; // Default white
    if (this.target.tintTopLeft !== 0xffffff) {
      colorNum = this.target.tintTopLeft;
    } else if (this.currentColor && this.currentColor.startsWith("#")) {
      colorNum = parseInt(this.currentColor.replace("#", ""), 16);
    } else if (
      typeof this.target.style.color === "string" &&
      this.target.style.color.startsWith("#")
    ) {
      colorNum = parseInt(this.target.style.color.replace("#", ""), 16);
    }

    this.underlineGraphics.lineStyle(
      Math.max(2, this.currentFontSize! / 20),
      colorNum,
      1
    );
    this.underlineGraphics.lineBetween(
      textBounds.left,
      textBounds.bottom + 4,
      textBounds.right,
      textBounds.bottom + 4
    );

    this.underlineGraphics.setDepth(this.target.depth + 1);
  }

  private removeUnderline(): void {
    if (this.underlineGraphics) {
      this.underlineGraphics.destroy();
      this.underlineGraphics = null;
    }
    if (this.updateUnderlineCallback) {
      this.scene.events.off("postupdate", this.updateUnderlineCallback);
      this.updateUnderlineCallback = undefined;
    }
  }

  stop(): void {
    this.scene.tweens.killTweensOf(this.target);
  }

  pause(): void {
    const tweens = this.scene.tweens.getTweensOf(this.target);
    tweens.forEach((tween) => tween.pause());
  }

  resume(): void {
    const tweens = this.scene.tweens.getTweensOf(this.target);
    tweens.forEach((tween) => tween.resume());
  }

  reset(): void {
    this.stop();
    this.removeUnderline();
  }

  public destroy(): void {
    if (this.tween) {
      this.tween.stop();
      this.tween = undefined;
    }

    this.removeUnderline();

    if (this.updateUnderlineCallback) {
      this.scene.events.off("postupdate", this.updateUnderlineCallback);
      this.updateUnderlineCallback = undefined;
    }

    this.isDestroyed = true;
  }
}
