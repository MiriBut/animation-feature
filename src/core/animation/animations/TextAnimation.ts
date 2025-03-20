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
    console.log("Raw fontSize from target:", rawFontSize);
    this.currentFontSize =
      rawFontSize && /\d+/.test(String(rawFontSize))
        ? parseInt(String(rawFontSize), 10)
        : 32;
    console.log("Final currentFontSize:", this.currentFontSize);

    const styleColor = this.target.style.color;
    this.currentColor = typeof styleColor === "string" ? styleColor : "#ffffff";

    this.currentStyle = { ...this.target.style };

    // Add support for text decoration from initial state
    if (this.target.getData("textDecoration") === "underline") {
      this.applyUnderline();
    }
  }

  async play(config: AnimationConfig): Promise<void> {
    if (this.isDestroyed) return Promise.resolve();

    // Check if the target text object is destroyed or inactive
    if (!this.target || !this.target.active) {
      // Recreate the text object with initial properties
      this.target = this.scene.add.text(
        this.target?.x || 0, // Use last known position or default to 0
        this.target?.y || 0,
        config.textValue || "", // Use provided text or empty string
        {
          fontFamily: this.currentStyle.fontFamily || "Arial",
          fontSize: `${this.currentFontSize || 32}px`,
          color: this.currentColor || "#ffffff",
          fontStyle: this.currentStyle.fontStyle || "normal",
        }
      );
      console.log("Text object recreated:", this.target.text);
    }

    if (config.property !== "text") return Promise.resolve();

    console.log(
      `Text animation play for ${this.target.name || "text"}:`,
      JSON.stringify(config, null, 2)
    );
    console.log(`Current fontSize:`, this.target.style.fontSize);
    console.log(`Current fontStyle:`, this.target.style.fontStyle);

    // Rest of your existing play method continues here...
    if (config.textValue) {
      this.target.setText(config.textValue);
    }
    this.updateFontStyle(config);

    const tweenConfig: any = {
      targets: this.target,
      duration: config.duration,
      ease: config.easing || "Linear",
    };

    // Add easeIn animation handling
    if (config.easing) {
      // Set initial alpha to 0 (completely transparent)
      this.target.setAlpha(0);

      // Add alpha animation to tweenConfig
      tweenConfig.alpha = { from: 0, to: 1 };

      // Make sure the underline also starts as transparent if it exists
      if (this.underlineGraphics) {
        this.underlineGraphics.setAlpha(0);

        // Create a separate tween for the underline with the same easing
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
        if (!this.target.active) return; // Stop updating if the text is destroyed
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
      const startColor = parseInt(config.color.startValue.replace("#", ""), 16);
      const endColor = parseInt(config.color.endValue.replace("#", ""), 16);
      tweenConfig.colorBlend = { from: 0, to: 1 };
      tweenConfig.onUpdate = (tween: Phaser.Tweens.Tween) => {
        if (!this.target.active) return; // Stop updating if the text is destroyed
        const value = tween.getValue() as number;
        const blendedColor = this.blendColors(startColor, endColor, value);
        this.target.setTint(blendedColor);
        this.currentColor = `#${blendedColor.toString(16).padStart(6, "0")}`;
        if (this.underlineGraphics) {
          this.updateUnderline();
        }
      };
    }

    // Store the tween and start it
    this.tween = this.scene.tweens.add(tweenConfig);

    // Add a timer to destroy the text and underline at the endTime
    this.scene.time.addEvent({
      delay: config.duration + (config.delay || 0),
      callback: () => {
        if (this.tween) {
          this.tween.stop(); // Stop the tween before destroying the text
          this.tween = undefined;
        }
        this.target.destroy();
        this.removeUnderline();
        console.log(
          `Text and underline destroyed at ${
            config.duration + (config.delay || 0)
          }ms for ${this.target.name || "text"}`
        );
      },
      callbackScope: this,
      loop: false,
    });

    return Promise.resolve();
  }

  // Helper method to blend two hex colors
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
    // Add safety check to ensure target is still active

    const newStyle: any = { ...this.target.style };

    // Determine font size
    let fontSizeValue: number;
    if (typeof config.fontSize === "string") {
      fontSizeValue = parseInt(config.fontSize, 10);
    } else if (config.fontSize && "endValue" in config.fontSize) {
      fontSizeValue = parseInt(String(config.fontSize.endValue), 10);
    } else {
      fontSizeValue = this.currentFontSize ?? 32;
    }
    this.currentFontSize = fontSizeValue;

    // Handle font weight and style combination
    let fontStyleValue = config.fontStyle || "normal";

    // If fontWeight is 'bold', modify fontStyle accordingly
    if (config.fontWeight === "bold") {
      fontStyleValue = fontStyleValue === "italic" ? "bold italic" : "bold";
    }

    // Set individual style properties explicitly
    newStyle.fontFamily = config.fontName || "Arial"; // Set fontFamily directly
    newStyle.fontSize = `${fontSizeValue}px`; // Set fontSize directly
    newStyle.fontStyle = fontStyleValue; // Combined fontStyle with potential bold

    // Record fontWeight for our own tracking (even though Phaser doesn't use it directly)
    this.currentFontWeight = config.fontWeight || "normal";

    console.log(
      `**font_setup_${config.assetName}** Font family set to:`,
      newStyle.fontFamily
    );
    console.log(
      `**font_setup_${config.assetName}** Font size set to:`,
      newStyle.fontSize
    );
    console.log(
      `**font_setup_${config.assetName}** Font style set to:`,
      newStyle.fontStyle
    );
    console.log(
      `**font_setup_${config.assetName}** Font weight used:`,
      this.currentFontWeight
    );

    // Handle text decoration
    if (config.textDecoration) {
      this.currentStyle.textDecoration = config.textDecoration;
      this.target.setData("textDecoration", config.textDecoration);
      if (config.textDecoration === "underline") {
        this.applyUnderline();
      } else if (config.textDecoration === "none") {
        this.removeUnderline();
      }
    }

    // Apply the new style to the text object
    this.target.setStyle(newStyle);
    console.log(
      `**font_result_${config.assetName}** Final style applied to text:`,
      this.target.style
    );
    // We can't check fontWeight directly as it's not in TextStyle
    console.log(
      `**font_validation_${config.assetName}** Applied font style:`,
      this.target.style.fontStyle
    );
  }

  private applyUnderline(): void {
    this.removeUnderline();

    this.underlineGraphics = this.scene.add.graphics();
    console.log("Underline graphics created for:", this.target.text);

    this.updateUnderlineCallback = () => {
      if (!this.target.active) return; // מפסיק לעדכן אם הטקסט נהרס
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
    // console.log("Text bounds:", textBounds); // לוג לבדיקה

    // Get text color - if it has a tint, use that instead
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

    // Draw the underline
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
    // console.log(
    //   `Drawing underline from (${textBounds.left}, ${
    //     textBounds.bottom + 4
    //   }) to (${textBounds.right}, ${textBounds.bottom + 4})`
    // ); // לוג לבדיקה

    // Make sure underline is at the same depth as text or slightly above
    this.underlineGraphics.setDepth(this.target.depth + 1); // שינוי לעומק גבוה יותר מהטקסט
  }
  // Method to remove underline
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
    // Pause all tweens affecting this text object
    const tweens = this.scene.tweens.getTweensOf(this.target);
    tweens.forEach((tween) => tween.pause());
  }

  resume(): void {
    // Resume all tweens affecting this text object
    const tweens = this.scene.tweens.getTweensOf(this.target);
    tweens.forEach((tween) => tween.resume());
  }

  reset(): void {
    this.stop();
    // Reset text to initial state if needed
    this.removeUnderline();
  }

  // Add this method to the TextAnimation class
  public destroy(): void {
    // Stop any active tweens
    if (this.tween) {
      this.tween.stop();
      this.tween = undefined;
    }

    // Remove underline if it exists
    this.removeUnderline();

    // Remove any event listeners
    if (this.updateUnderlineCallback) {
      this.scene.events.off("postupdate", this.updateUnderlineCallback);
      this.updateUnderlineCallback = undefined;
    }

    this.isDestroyed = true;
  }
}
