import {
  TimelineJson,
  TimelineElement,
  TimelineAnimation,
} from "../../types/interfaces/TimelineInterfaces";
import { Validators } from "../utils/Validators";
import { Helpers } from "../utils/Helpers";

type AnimationType = "scale" | "position" | "color" | "opacity" | "rotation";

export class TimelineService {
  private assetsMap: Map<string, { url: string; type: string }>;

  constructor(assetsMap: Map<string, { url: string; type: string }>) {
    this.assetsMap = assetsMap;
  }

  public async validateTimelineJson(json: TimelineJson): Promise<string[]> {
    const errors: string[] = [];

    try {
      // 1. בדיקת מבנה בסיסי
      if (
        !json["template video json"] ||
        !Array.isArray(json["template video json"])
      ) {
        throw new Error("Missing template video json array");
      }

      // 2. נרמול האלמנטים
      const normalizedElements = json["template video json"].map((element) =>
        this.normalizeTimelineElement(element)
      );

      // 3. בדיקת תקינות לכל אלמנט
      const elementErrors = normalizedElements.flatMap((element, index) =>
        Validators.validateTimelineElement(element, index)
      );
      errors.push(...elementErrors);

      // 4. בדיקת רצף הזמן
      const sequenceErrors = this.validateTimelineSequence(normalizedElements);
      errors.push(...sequenceErrors);

      // 5. הצלבה עם הנכסים הקיימים
      const assetReferenceErrors = await this.validateAssetReferences(
        normalizedElements
      );
      errors.push(...assetReferenceErrors);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    // סינון שגיאות ריקות והחזרת מערך נקי
    return errors.filter(Boolean);
  }

  private normalizeTimelineElement(element: any): TimelineElement {
    return {
      ...element,
      elementName: element.elementName || element.assetName,
      assetType: element.assetType || "image",
      onScreen: element.onScreen || undefined,
      initialState: {
        ...element.initialState,
        position: element.initialState?.position
          ? {
              x: Number(element.initialState.position.x) || 0,
              y: Number(element.initialState.position.y) || 0,
              z: Number(element.initialState.position.z) || 0,
            }
          : undefined,
        scale: element.initialState?.scale
          ? {
              x: Number(element.initialState.scale.x) || 1,
              y: Number(element.initialState.scale.y) || 1,
            }
          : undefined,
        opacity: Number(element.initialState?.opacity) || 1,
        rotation: Number(element.initialState?.rotation) || 0,
        color: element.initialState?.color || "0xFFFFFF",
      },
    };
  }

  private validateTimelineSequence(elements: TimelineElement[]): string[] {
    const errors: string[] = [];

    elements.forEach((element, index) => {
      if (element.timeline) {
        const timelineErrors = this.validateAnimationSequence(
          element.timeline,
          `Element ${index + 1} (${element.elementName})`
        );
        errors.push(...timelineErrors);
      }
    });

    return errors;
  }

  private validateAnimationSequence(
    timeline: NonNullable<TimelineElement["timeline"]>,
    prefix: string
  ): string[] {
    const errors: string[] = [];
    const animationTypes: AnimationType[] = [
      "scale",
      "position",
      "color",
      "opacity",
      "rotation",
    ];

    animationTypes.forEach((type) => {
      const animations = timeline[type];
      if (animations && Array.isArray(animations)) {
        for (let i = 0; i < animations.length; i++) {
          // בדיקת ערכי זמן תקינים
          if (
            animations[i].startTime < 0 ||
            animations[i].endTime <= animations[i].startTime
          ) {
            errors.push(
              `${prefix}: Invalid time range for ${type} animation: ` +
                `${animations[i].startTime}-${animations[i].endTime}`
            );
          }

          // בדיקת חפיפה עם אנימציות אחרות
          for (let j = i + 1; j < animations.length; j++) {
            if (Helpers.isTimeRangeOverlapping(animations[i], animations[j])) {
              errors.push(
                `${prefix}: Overlapping ${type} animations detected between ` +
                  `${animations[i].startTime}-${animations[i].endTime} and ` +
                  `${animations[j].startTime}-${animations[j].endTime}`
              );
            }
          }
        }
      }
    });

    return errors;
  }

  private async validateAssetReferences(
    elements: TimelineElement[]
  ): Promise<string[]> {
    const errors: string[] = [];
    // this.assetsMap.forEach((value, key) => {
    //   console.log(`++++++++Key: ${key}, Value:`, value);
    // });

    for (const element of elements) {
      const assetInfo = this.assetsMap.get(element.assetName);

      // if (!assetInfo) {
      //   errors.push(
      //     `Element ${element.assetName}: Asset "${element.assetName}" not found in assets JSON`
      //   );
      // }
    }

    return errors;
  }
}
