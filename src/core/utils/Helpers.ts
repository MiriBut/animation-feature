import { TimelineAnimation } from "../../types/interfaces/TimelineInterfaces";
import { showMessage } from "../../ui/ErrorModal/MessageModal";
import { TimelineJson } from "../../types/interfaces/TimelineInterfaces"; // Ensure the correct path

export class Helpers {
  static async checkAssetExists(url: string): Promise<boolean> {
    try {
      // Try multiple strategies to check the asset
      const fullUrls = [
        url, // Original path
        `/assets/images/${url}`, // Try with a static prefix
        `${window.location.origin}/assets/images/${url}`, // Try with full origin
      ];

      for (const fullUrl of fullUrls) {
        try {
          const response = await fetch(fullUrl, { method: "HEAD" });
          if (response.ok) return true;
        } catch {}
      }

      console.warn(`Asset not found: ${url}`);
      return false;
    } catch (error) {
      console.error("Asset check failed:", error);
      return false;
    }
  }

  /**
   * Validates and parses a JSON file
   */
  static async validateAndParseJson(file: File): Promise<any> {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Add more detailed logs
      console.log("Parsed JSON structure:", Object.keys(json));

      if (!json || typeof json !== "object") {
        throw new Error("Invalid JSON structure: Root must be an object");
      }

      // Enhance validation
      const isTemplate = json["template video json"] !== undefined;
      const isAsset = json.assets !== undefined;

      if (!isTemplate && !isAsset) {
        console.warn("JSON structure:", json);
        throw new Error("Unable to identify JSON file type");
      }

      return json;
    } catch (error) {
      // Add more detailed error logging
      console.error("JSON parsing error:", error);

      if (error instanceof Error) {
        throw new Error(`Failed to parse JSON: ${error.message}`);
      }
      throw new Error("Failed to parse JSON: Unknown error");
    }
  }

  static async validateAssetReferences(json: TimelineJson): Promise<void> {
    const assetChecks = json["template video json"].map(async (item) => {
      if (item.assetName) {
        const exists = await this.checkAssetExists(item.assetName);
        if (!exists) {
          console.warn(`Asset not found: ${item.assetName}`);
          // Optional: Throw an error if a critical asset is missing
          // throw new Error(`Missing asset: ${item.assetName}`);
        }
      }
    });

    await Promise.all(assetChecks);
  }

  /**
   * Checks if time ranges overlap
   */
  static isTimeRangeOverlapping(
    anim1: TimelineAnimation,
    anim2: TimelineAnimation
  ): boolean {
    return anim1.startTime < anim2.endTime && anim2.startTime < anim1.endTime;
  }

  /**
   * Handles errors uniformly
   */
  static handleError(error: unknown, title: string = "Unexpected Error"): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage({
      isOpen: true,
      // type: "error",
      title,
      messages: [errorMessage],
    });
    console.error("Debug info:", errorMessage);
  }

  /**
   * Converts a CSS color format to Phaser color format
   */
  static cssColorToPhaserColor(cssColor: string): number {
    if (cssColor.startsWith("#")) {
      return parseInt(cssColor.slice(1), 16);
    }
    if (cssColor.startsWith("0x")) {
      return parseInt(cssColor, 16);
    }
    return 0xffffff; // Default - white
  }

  /**
   * Rounds a number to a defined precision
   */
  static roundToDecimalPlaces(num: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  /**
   * Checks if two objects are equal (useful for state comparisons)
   */
  static areObjectsEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;
    if (typeof obj1 !== typeof obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(
      (key) =>
        obj1[key] === obj2[key] ||
        (typeof obj1[key] === "object" &&
          this.areObjectsEqual(obj1[key], obj2[key]))
    );
  }

  /**
   * Generates a unique identifier
   */
  static generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Converts milliseconds to a readable time format
   */
  static formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}
