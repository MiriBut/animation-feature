import {
  TimelineElement,
  TimelineAnimation,
} from "../../types/interfaces/TimelineInterfaces";
import { Asset } from "../../types/interfaces/AssetInterfaces";

export class Validators {
  static isValidNumberPair(
    obj: any,
    xKey: string = "x",
    yKey: string = "y"
  ): boolean {
    return (
      obj &&
      typeof obj === "object" &&
      typeof obj[xKey] === "number" &&
      typeof obj[yKey] === "number"
    );
  }

  static isValidPosition(pos: any): boolean {
    return (
      pos &&
      typeof pos === "object" &&
      typeof pos.x === "number" &&
      typeof pos.y === "number" &&
      typeof pos.z === "number"
    );
  }

  static isValidColor(color: string): boolean {
    const cssHexPattern = /^#([A-Fa-f0-9]{3}){1,2}$/;
    const phaserHexPattern = /^0x[A-Fa-f0-9]{6}$/;
    const basicColors = [
      "black",
      "white",
      "red",
      "green",
      "blue",
      "yellow",
      "purple",
      "orange",
      "gray",
      "brown",
    ];

    return (
      cssHexPattern.test(color) ||
      phaserHexPattern.test(color) ||
      basicColors.includes(color.toLowerCase())
    );
  }

  static isValidEaseEquation(equation: string): boolean {
    const validEquations = [
      "Linear",
      "Quad.easeIn",
      "Quad.easeOut",
      "Quad.easeInOut",
      "Cubic.easeIn",
      "Cubic.easeOut",
      "Cubic.easeInOut",
      "Quart.easeIn",
      "Quart.easeOut",
      "Quart.easeInOut",
      "Quint.easeIn",
      "Quint.easeOut",
      "Quint.easeInOut",
      "Sine.easeIn",
      "Sine.easeOut",
      "Sine.easeInOut",
      "Expo.easeIn",
      "Expo.easeOut",
      "Expo.easeInOut",
      "Circ.easeIn",
      "Circ.easeOut",
      "Circ.easeInOut",
      "Back.easeIn",
      "Back.easeOut",
      "Back.easeInOut",
      "Bounce.easeIn",
      "Bounce.easeOut",
      "Bounce.easeInOut",
    ];

    return validEquations.includes(equation);
  }

  static validateAssetObject(asset: Asset, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Asset ${index + 1}:`;

    if (!asset.assetName) errors.push(`${prefix} Missing assetName`);
    if (!asset.assetUrl) errors.push(`${prefix} Missing assetUrl`);
    if (!asset.assetType) errors.push(`${prefix} Missing assetType`);

    if (
      asset.assetType &&
      !["image", "audio", "video"].includes(asset.assetType)
    ) {
      errors.push(
        `${prefix} Invalid assetType "${asset.assetType}". Must be one of: image, audio, video`
      );
    }

    if (asset.assetName && !/^[a-zA-Z0-9_-]+$/.test(asset.assetName)) {
      errors.push(`${prefix} Invalid assetName format`);
    }

    if (asset.assetUrl) {
      try {
        new URL(asset.assetUrl, window.location.origin);
      } catch {
        errors.push(`${prefix} Invalid assetUrl format`);
      }
    }

    if (asset.scale_override && !this.isValidNumberPair(asset.scale_override)) {
      errors.push(`${prefix} Invalid scale_override format`);
    }

    if (
      asset.aspect_ratio_override &&
      !this.isValidNumberPair(asset.aspect_ratio_override, "width", "height")
    ) {
      errors.push(`${prefix} Invalid aspect_ratio_override format`);
    }

    if (asset.pivot_override && !this.isValidNumberPair(asset.pivot_override)) {
      errors.push(`${prefix} Invalid pivot_override format`);
    }

    return errors;
  }

  static validateTimelineElement(
    element: TimelineElement,
    index: number
  ): string[] {
    const errors: string[] = [];
    const prefix = `Template element ${index + 1}:`;

    // בדיקות בסיסיות
    if (!element.elementName) errors.push(`${prefix} Missing elementName`);
    if (!element.assetType) errors.push(`${prefix} Missing assetType`);
    if (!element.assetName) errors.push(`${prefix} Missing assetName`);

    // בדיקת מצב התחלתי
    if (element.initialState) {
      if (typeof element.initialState !== "object") {
        errors.push(`${prefix} initialState must be an object`);
      } else {
        this.validateInitialState(element.initialState, prefix, errors);
      }
    }

    // בדיקת טיימליין
    if (element.timeline) {
      const timelineErrors = this.validateTimeline(
        element.timeline,
        `${prefix} Timeline:`
      );
      errors.push(...timelineErrors);
    }

    return errors;
  }

  private static validateInitialState(
    initialState: any,
    prefix: string,
    errors: string[]
  ): void {
    if (initialState.position && !this.isValidPosition(initialState.position)) {
      errors.push(`${prefix} Invalid position format in initialState`);
    }

    if (initialState.scale && !this.isValidNumberPair(initialState.scale)) {
      errors.push(`${prefix} Invalid scale format in initialState`);
    }

    if (initialState.opacity !== undefined) {
      const opacity = initialState.opacity;
      if (typeof opacity !== "number" || opacity < 0 || opacity > 1) {
        errors.push(`${prefix} Opacity must be a number between 0 and 1`);
      }
    }

    if (initialState.color && !this.isValidColor(initialState.color)) {
      errors.push(`${prefix} Invalid color format in initialState`);
    }

    if (
      initialState.rotation !== undefined &&
      typeof initialState.rotation !== "number"
    ) {
      errors.push(`${prefix} Rotation must be a number`);
    }
  }

  private static validateTimeline(timeline: any, prefix: string): string[] {
    const errors: string[] = [];
    const animationTypes = [
      "scale",
      "position",
      "color",
      "opacity",
      "rotation",
    ];

    animationTypes.forEach((type) => {
      if (timeline[type]) {
        if (!Array.isArray(timeline[type])) {
          errors.push(`${prefix} ${type} must be an array`);
        } else {
          timeline[type].forEach((anim: TimelineAnimation, index: number) => {
            const animErrors = this.validateAnimation(
              anim,
              `${type} animation ${index + 1}`
            );
            errors.push(...animErrors);
          });
        }
      }
    });

    return errors;
  }

  private static validateAnimation(
    anim: TimelineAnimation,
    prefix: string
  ): string[] {
    const errors: string[] = [];

    if (typeof anim.startTime !== "number")
      errors.push(`${prefix}: Missing or invalid startTime`);
    if (typeof anim.endTime !== "number")
      errors.push(`${prefix}: Missing or invalid endTime`);
    if (anim.startTime >= anim.endTime)
      errors.push(`${prefix}: startTime must be less than endTime`);
    if (!this.isValidEaseEquation(anim.easeIn))
      errors.push(`${prefix}: Invalid easeIn function`);
    if (!this.isValidEaseEquation(anim.easeOut))
      errors.push(`${prefix}: Invalid easeOut function`);

    return errors;
  }
}
