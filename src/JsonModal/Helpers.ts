import { TimelineAnimation } from "./Interfaces";
import { showMessage } from "../ui/ErrorModal/MessageModal";

export class Helpers {
  static async checkAssetExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async validateAndParseJson(file: File): Promise<any> {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!json || typeof json !== "object") {
        throw new Error("Invalid JSON structure: Root must be an object");
      }

      const isTemplate = json["template video json"] !== undefined;
      const isAsset = json.assets !== undefined;

      if (!isTemplate && !isAsset) {
        throw new Error("Unable to identify JSON file type");
      }

      if (isTemplate && isAsset) {
        throw new Error(
          "Ambiguous JSON file: Contains both template and asset structures"
        );
      }

      return json;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse JSON: ${error.message}`);
      }
      throw new Error("Failed to parse JSON: Unknown error");
    }
  }

  static isTimeRangeOverlapping(
    anim1: TimelineAnimation,
    anim2: TimelineAnimation
  ): boolean {
    return anim1.startTime < anim2.endTime && anim2.startTime < anim1.endTime;
  }

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
}
