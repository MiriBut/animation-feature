import {
  TimelineJson,
  TimelineElement,
  TimelineAnimation,
} from "../../types/interfaces/TimelineInterfaces";
import { Validators } from "../utils/Validators";
import { Helpers } from "../utils/Helpers";

import { AssetService } from "./AssetService"; // נניח שיש לך גישה ל-AssetService

type AnimationType = "scale" | "position" | "color" | "opacity" | "rotation";

interface AssetValidationResult {
  assetName: string;
  exists: boolean;
  type?: string;
  loaded?: boolean; // נוסף כדי לעקוב אחרי תוצאות טעינה
}

export class TimelineService {
  private assetsMap: Map<string, { url: string; type: string }>;
  private assetService?: AssetService; // אופציונלי: לשילוב עם AssetService

  constructor(
    assetsMap: Map<string, { url: string; type: string }>,
    assetService?: AssetService
  ) {
    this.assetsMap = assetsMap;
    this.assetService = assetService; // אם תרצה לטעון נכסים חסרים
    console.log("TimelineService initialized with assetsMap:", assetsMap.size);
  }

  public async handleTimelineJson(file: File): Promise<void> {
    try {
      console.log("Starting to handle timeline JSON file:", file.name);

      // this.showDirectMessage("טוען טיימליין", [
      //   { type: "info", content: `טוען את קובץ ${file.name}...` },
      // ]);

      const fileContent = await file.text();
      let json: TimelineJson;

      try {
        json = JSON.parse(fileContent) as TimelineJson;
        console.log("Timeline JSON parsed successfully");
      } catch (parseError) {
        // this.showDirectMessage("שגיאת פענוח JSON", [
        //   { type: "error", content: "הקובץ אינו בפורמט JSON תקין" },
        // ]);
        return;
      }

      if (
        !json["template video json"] ||
        !Array.isArray(json["template video json"])
      ) {
        // this.showDirectMessage("מבנה קובץ שגוי", [
        //   {
        //     type: "error",
        //     content: "חסר מפתח 'template video json' או שאינו מערך",
        //   },
        // ]);
        return;
      }

      const validationErrors = await this.validateTimelineJson(json);
      if (validationErrors.length > 0) {
        // this.showDirectMessage("בעיות במבנה קובץ הטיימליין", [
        //   ...validationErrors.map((error) => ({
        //     type: "error" as MessageType,
        //     content: error,
        //   })),
        // ]);
        return;
      }

      const assetValidationResults = await this.validateAndLoadAssets(
        json["template video json"]
      );
      this.displayLoadResults(assetValidationResults);

      console.log("Timeline handling process completed");
    } catch (error) {
      // const errorMessage =
      //   error instanceof Error
      //     ? error.message
      //     : "שגיאה לא ידועה בטעינת הטיימליין";
      // this.showDirectMessage("שגיאה בטעינת הטיימליין", [
      //   { type: "error", content: errorMessage },
      // ]);
    }
  }

  // private showDirectMessage(title: string, messages: Message[]): void {
  //   showMessage({
  //     isOpen: true,
  //     title: title,
  //     messages: messages,
  //     autoClose: false,
  //   });
  // }

  // שילוב בדיקה וטעינה של נכסים
  public async validateAndLoadAssets(
    elements: TimelineElement[]
  ): Promise<AssetValidationResult[]> {
    console.log("Starting validateAndLoadAssets with elements:", elements);
    const results: AssetValidationResult[] = [];

    for (const element of elements) {
      const assetName = element.assetName;
      console.log(`Processing asset: ${assetName}`);
      const assetInfo = this.assetsMap.get(assetName);
      const exists = !!assetInfo;

      let loaded = exists;
      if (!exists && this.assetService) {
        console.log(`Asset ${assetName} not found, attempting to load`);
        const loadResult = await this.assetService.loadAsset(assetName);
        console.log(`Load result for ${assetName}:`, loadResult);
        loaded = loadResult.success;
        if (loaded) {
          this.assetsMap.set(assetName, {
            url: element.assetUrl as string,
            type: element.assetType || "image",
          });
        }
      }

      results.push({
        assetName: assetName,
        exists: exists,
        type: assetInfo?.type,
        loaded: loaded,
      });
    }

    console.log("validateAndLoadAssets completed, results:", results);
    return results;
  }

  public displayLoadResults(results: AssetValidationResult[]): void {
    console.log("Starting displayLoadResults with results:", results);
    const successfulAssets = results.filter((result) => result.loaded);
    const failedAssets = results.filter((result) => !result.loaded);

    const messages: any[] = [];

    if (successfulAssets.length > 0) {
      // messages.push(
      //   createSuccessMessage(
      //     `${successfulAssets.length} ${
      //       successfulAssets.length === 1 ? "נכס נטען" : "נכסים נטענו"
      //     } בהצלחה`
      //   )
      // );
      successfulAssets.forEach((asset) => {
        // messages.push(
        //   createInfoMessage(
        //     `נטען בהצלחה: ${asset.assetName} (סוג: ${asset.type || "לא ידוע"})`
        //   )
        // );
      });
    }

    if (failedAssets.length > 0) {
      failedAssets.forEach((asset) => {
        // messages.push(
        //   createErrorMessage(`נכשל בטעינה: ${asset.assetName} - לא נמצא במערכת`)
        // );
      });
    }

    console.log("Messages prepared:", messages);
    // showMessage({
    //   isOpen: true,
    //   title: "תוצאות טעינת נכסים לטיימליין",
    //   messages: messages,
    //   autoClose: successfulAssets.length > 0 && failedAssets.length === 0,
    //   autoCloseTime: 5000,
    // });
    console.log("displayLoadResults completed");
  }

  // שאר הפונקציות נשארות כפי שהיו (validateTimelineJson, normalizeTimelineElement וכו')
  public async validateTimelineJson(json: TimelineJson): Promise<string[]> {
    const errors: string[] = [];

    json["template video json"].forEach((element, index) => {
      const prefix = `Element #${index + 1} (${
        element.elementName || element.assetName || "unnamed"
      })`;

      if (!element.assetName) {
        errors.push(`${prefix}: 'assetName' is missing`);
      }
      if (!element.assetType) {
        errors.push(`${prefix}: 'assetType' is missing`);
      } else if (
        !["image", "video", "particle", "spine", "audio"].includes(
          element.assetType
        )
      ) {
        errors.push(
          `${prefix}: 'assetType' must be one of: image, video, particle, spine, audio`
        );
      }

      if (element.assetType === "audio" && element.initialState) {
        if (
          element.initialState.volume !== undefined &&
          (element.initialState.volume < 0 || element.initialState.volume > 1)
        ) {
          errors.push(
            `${prefix}: 'initialState.volume' must be between 0 and 1`
          );
        }
      }

      if (element.timeline && element.assetType === "audio") {
        if (element.timeline.play) {
          element.timeline.play.forEach((play, playIndex) => {
            if (play.startTime > play.endTime) {
              errors.push(
                `${prefix}: Timeline play #${playIndex + 1} - 'startTime' (${
                  play.startTime
                }) is greater than 'endTime' (${play.endTime})`
              );
            }
          });
        }
      }
    });

    return errors;
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
          if (
            animations[i].startTime < 0 ||
            animations[i].endTime <= animations[i].startTime
          ) {
            errors.push(
              `${prefix}: Invalid time range for ${type} animation: ` +
                `${animations[i].startTime}-${animations[i].endTime}`
            );
          }
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
}
