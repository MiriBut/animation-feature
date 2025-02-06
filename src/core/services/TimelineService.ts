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
      const normalizedElements = json["template video json"].map(
        this.normalizeTimelineElement
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

    return errors;
  }

  private normalizeTimelineElement(element: any): TimelineElement {
    return {
      ...element,
      assetType: element.assetType as "image" | "video" | "text",
      initialState: {
        ...element.initialState,
        position: element.initialState?.position
          ? {
              x: element.initialState.position.x,
              y: element.initialState.position.y,
              z: Number(element.initialState.position.z ?? 0),
            }
          : undefined,
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

    for (const element of elements) {
      const assetInfo = this.assetsMap.get(element.assetName);

      if (!assetInfo) {
        errors.push(
          `Element ${element.elementName}: Asset "${element.assetName}" not found in assets JSON`
        );
        continue;
      }

      if (element.assetType !== assetInfo.type) {
        errors.push(
          `Element ${element.elementName}: Asset type mismatch. ` +
            `Timeline expects "${element.assetType}" but asset is of type "${assetInfo.type}"`
        );
      }

      const exists = await Helpers.checkAssetExists(assetInfo.url);
      if (!exists) {
        errors.push(
          `Element ${element.elementName}: Asset file not found at "${assetInfo.url}"`
        );
      }
    }

    return errors;
  }
}
