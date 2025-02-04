import { TimelineAnimation } from "../../types/interfaces/TimelineInterfaces";
import { showMessage } from "../../ui/ErrorModal/MessageModal";
import { TimelineJson } from "../../types/interfaces/TimelineInterfaces"; // וודא את הנתיב הנכון

export class Helpers {
  /**
   * בודק אם נכס קיים בשרת
   */
  static async checkAssetExists(url: string): Promise<boolean> {
    try {
      // נסה מספר אסטרטגיות לבדיקת נכס
      const fullUrls = [
        url, // הנתיב המקורי
        `/assets/images/${url}`, // נסה עם תחילית סטטית
        `${window.location.origin}/assets/images/${url}`, // נסה עם מקור מלא
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
   * מאמת ומפרסר קובץ JSON
   */
  static async validateAndParseJson(file: File): Promise<any> {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // הוסף לוגים מפורטים יותר
      console.log("Parsed JSON structure:", Object.keys(json));

      if (!json || typeof json !== "object") {
        throw new Error("Invalid JSON structure: Root must be an object");
      }

      // הגדל את הבדיקות
      const isTemplate = json["template video json"] !== undefined;
      const isAsset = json.assets !== undefined;

      if (!isTemplate && !isAsset) {
        console.warn("JSON structure:", json);
        throw new Error("Unable to identify JSON file type");
      }

      return json;
    } catch (error) {
      // הוסף לוג מפורט יותר לשגיאות
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
          // אופציונלי: זרוק שגיאה אם חסר נכס קריטי
          // throw new Error(`Missing asset: ${item.assetName}`);
        }
      }
    });

    await Promise.all(assetChecks);
  }

  /**
   * בודק אם טווחי זמן חופפים
   */
  static isTimeRangeOverlapping(
    anim1: TimelineAnimation,
    anim2: TimelineAnimation
  ): boolean {
    return anim1.startTime < anim2.endTime && anim2.startTime < anim1.endTime;
  }

  /**
   * מטפל בשגיאות בצורה אחידה
   */
  static handleError(error: unknown, title: string = "Unexpected Error"): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage({
      isOpen: true,
      type: "error",
      title,
      messages: [errorMessage],
    });
    console.error("Debug info:", errorMessage);
  }

  /**
   * ממיר צבע מפורמט CSS לפורמט Phaser
   */
  static cssColorToPhaserColor(cssColor: string): number {
    if (cssColor.startsWith("#")) {
      return parseInt(cssColor.slice(1), 16);
    }
    if (cssColor.startsWith("0x")) {
      return parseInt(cssColor, 16);
    }
    return 0xffffff; // ברירת מחדל - לבן
  }

  /**
   * מעגל מספר לדיוק מוגדר
   */
  static roundToDecimalPlaces(num: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  /**
   * בודק אם שני אובייקטים שווים (שימושי להשוואת מצבים)
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
   * יוצר מזהה ייחודי
   */
  static generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ממיר מילישניות לפורמט זמן קריא
   */
  static formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}
