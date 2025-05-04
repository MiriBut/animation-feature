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
  loaded?: boolean;
}

export class TimelineService {
  private assetsMap: Map<string, { url: string; type: string }>;
  private assetService?: AssetService;
  private scene?: Phaser.Scene; // Add scene for resolution access

  constructor(
    assetsMap: Map<string, { url: string; type: string }>,
    assetService?: AssetService,
    scene?: Phaser.Scene
  ) {
    this.assetsMap = assetsMap;
    this.assetService = assetService;
    this.scene = scene;
    // console.log("TimelineService initialized with assetsMap:", assetsMap.size);
  }

  public async handleTimelineJson(file: File): Promise<void> {
    try {
      const fileContent = await file.text();
      let json: TimelineJson = JSON.parse(fileContent) as TimelineJson;

      if (
        !json["template video json"] ||
        !Array.isArray(json["template video json"])
      ) {
        console.error("Invalid timeline JSON structure");
        return;
      }

      const validationErrors = await this.validateTimelineJson(json);
      if (validationErrors.length > 0) {
        console.error("Validation errors:", validationErrors);
        return;
      }

      const assetValidationResults = await this.validateAndLoadAssets(
        json["template video json"]
      );
      this.displayLoadResults(assetValidationResults);

      await this.processTimelineElements(json["template video json"]);
      // VideoService will handle rendering with resolution adjustments

      console.log("Timeline handling process completed");
    } catch (error) {
      console.error("Error handling timeline JSON:", error);
    }
  }

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
      successfulAssets.forEach((asset) => {});
    }

    if (failedAssets.length > 0) {
      failedAssets.forEach((asset) => {});
    }

    console.log("Messages prepared:", messages);

    console.log("displayLoadResults completed");
  }

  public async validateTimelineJson(json: TimelineJson): Promise<string[]> {
    const errors: string[] = [];

    json["template video json"].forEach((element, index) => {
      const prefix = `Element #${index + 1} (${
        element.elementName || element.assetName || "unnamed"
      })`;

      // Existing checks
      if (!element.assetName) {
        errors.push(`${prefix}: 'assetName' is missing`);
      }
      if (!element.assetType) {
        errors.push(`${prefix}: 'assetType' is missing`);
      } else if (
        !["image", "video", "particle", "spine", "audio", "text"].includes(
          element.assetType
        )
      ) {
        errors.push(
          `${prefix}: 'assetType' must be one of: image, video, particle, spine, audio, text`
        );
      }

      // Audio-specific validation
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

      // Text-specific validation
      if (element.assetType === "text") {
        console.log("element.assetType === text");
        if (element.initialState) {
          if (
            element.initialState.text === undefined ||
            typeof element.initialState.text !== "string"
          ) {
            errors.push(
              `${prefix}: 'initialState.text' must be a non-empty string`
            );
          }

          // Normalize fontSize to a number in pixels
          const fontSize = element.initialState?.fontSize
            ? typeof element.initialState.fontSize === "string"
              ? parseInt(element.initialState.fontSize, 10)
              : element.initialState.fontSize
            : 16; // Default font size

          // Fix: Check if fontSize exists and is a string before testing with regex
          if (
            element.initialState.fontSize &&
            (typeof element.initialState.fontSize !== "string" ||
              !/^\d+px$/.test(element.initialState.fontSize))
          ) {
            errors.push(
              `${prefix}: 'initialState.fontSize' must be in format 'number}px', e.g., '32px'`
            );
          }
          console.log("fontSize : " + fontSize);
          console.log("fontSize : " + element.initialState.fontSize);

          if (
            element.initialState.color &&
            !/^#[0-9A-Fa-f]{6}$/.test(element.initialState.color)
          ) {
            errors.push(
              `${prefix}: 'initialState.color' must be a valid hex color, e.g., '#ffffff'`
            );
          }
        }
        if (element.timeline && element.timeline.text) {
          element.timeline.text.forEach(
            (
              textAnim: {
                startTime: number;
                endTime: number;
                value: string;
                fontSize: { startValue: number; endValue: number };
                color: { startValue: string; endValue: string };
              },
              textIndex: number
            ) => {
              if (textAnim.startTime > textAnim.endTime) {
                errors.push(
                  `${prefix}: Timeline text #${textIndex + 1} - 'startTime' (${
                    textAnim.startTime
                  }) is greater than 'endTime' (${textAnim.endTime})`
                );
              }
              if (typeof textAnim.value !== "string" || textAnim.value === "") {
                errors.push(
                  `${prefix}: Timeline text #${
                    textIndex + 1
                  } - 'value' must be a non-empty string`
                );
              }

              if (textAnim.fontSize) {
                if (
                  typeof textAnim.fontSize.startValue !== "number" ||
                  textAnim.fontSize.startValue <= 0
                ) {
                  errors.push(
                    `${prefix}: Timeline text #${
                      textIndex + 1
                    } - 'fontSize.startValue' must be a positive number`
                  );
                }
                if (
                  typeof textAnim.fontSize.endValue !== "number" ||
                  textAnim.fontSize.endValue <= 0
                ) {
                  errors.push(
                    `${prefix}: Timeline text #${
                      textIndex + 1
                    } - 'fontSize.endValue' must be a positive number`
                  );
                }
              }
              if (textAnim.color) {
                if (!/^#[0-9A-Fa-f]{6}$/.test(textAnim.color.startValue)) {
                  errors.push(
                    `${prefix}: Timeline text #${
                      textIndex + 1
                    } - 'color.startValue' must be a valid hex color`
                  );
                }
                if (!/^#[0-9A-Fa-f]{6}$/.test(textAnim.color.endValue)) {
                  errors.push(
                    `${prefix}: Timeline text #${
                      textIndex + 1
                    } - 'color.endValue' must be a valid hex color`
                  );
                }
              }
            }
          );
        }
      }

      // Validate TimelineElement.onScreen
      // if (element.onScreen) {
      //   if (!Array.isArray(element.onScreen)) {
      //     errors.push(`${prefix}: 'onScreen' mus2
      //       t be an array`);
      //   } else {
      //     element.onScreen.forEach(
      //       (
      //         onScreenItem: { time: number; value: boolean },
      //         onScreenIndex: number
      //       ) => {
      //         if (
      //           typeof onScreenItem.time !== "number" ||
      //           onScreenItem.time < 0
      //         ) {
      //           errors.push(
      //             `${prefix}: 'onScreen' item #${
      //               onScreenIndex + 1
      //             } - 'time' must be a non-negative number`
      //           );
      //         }
      //         if (typeof onScreenItem.value !== "boolean") {
      //           errors.push(
      //             `${prefix}: 'onScreen' item #${
      //               onScreenIndex + 1
      //             } - 'value' must be a boolean`
      //           );
      //         }
      //       }
      //     );
      //     for (let i = 1; i < element.onScreen.length; i++) {
      //       if (element.onScreen[i].time <= element.onScreen[i - 1].time) {
      //         errors.push(
      //           `${prefix}: 'onScreen' items must be in ascending time order`
      //         );
      //       }
      //     }
      //   }
      // }

      // Validate timeline.onScreen as TimelineAnimation[]
      if (element.timeline?.onScreen) {
        if (!Array.isArray(element.timeline.onScreen)) {
          errors.push(`${prefix}: 'timeline.onScreen' must be an array`);
        } else {
          element.timeline.onScreen.forEach((onScreenAnim, onScreenIndex) => {
            if (
              typeof onScreenAnim.start !== "number" ||
              onScreenAnim.start < 0
            ) {
              errors.push(
                `${prefix}: 'timeline.onScreen' item #${
                  onScreenIndex + 1
                } - 'start' must be a non-negative number`
              );
            }
            if (
              typeof onScreenAnim.value !== "string" ||
              !["true", "false"].includes(onScreenAnim.value)
            ) {
              errors.push(
                `${prefix}: 'timeline.onScreen' item #${
                  onScreenIndex + 1
                } - 'value' must be a string of 'true' or 'false'`
              );
            }
          });
        }
      }
    });

    return errors;
  }

  private normalizeTimelineElement(element: any): TimelineElement {
    const sceneWidth = this.scene?.scale.width ?? 1920; // Default fallback
    const sceneHeight = this.scene?.scale.height ?? 1080;

    let position = {
      x: Number(element.initialState?.position?.x) || 0,
      y: Number(element.initialState?.position?.y) || 0,
      z: Number(element.initialState?.position?.z) || 0,
    };

    // Handle anchor if provided
    if (element.initialState?.anchor) {
      const anchor = element.initialState.anchor;
      // Validate anchor values
      if (
        typeof anchor.x !== "number" ||
        anchor.x < 0 ||
        anchor.x > 1 ||
        typeof anchor.y !== "number" ||
        anchor.y < 0 ||
        anchor.y > 1
      ) {
        console.warn(
          `Invalid anchor values for ${element.assetName}, defaulting to (0.5, 0.5)`
        );
        anchor.x = 0.5;
        anchor.y = 0.5;
      }

      // Calculate base position from anchor
      const anchorX = anchor.x * sceneWidth;
      const anchorY = anchor.y * sceneHeight;

      // Get pivot from AssetService
      const pivot = this.assetService?.getAssetPivot(element.assetName) || {
        x: 0.5,
        y: 0.5,
      };

      // Adjust position based on pivot (assuming sprite size is available later in AssetService)
      position.x = anchorX; // Will be adjusted in VideoService with sprite size
      position.y = anchorY;
    }

    return {
      ...element,
      elementName: element.elementName || element.assetName,
      assetType: element.assetType || "image",
      onScreen: element.onScreen || undefined,
      initialState: {
        ...element.initialState,
        position: position,
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

  public async processTimelineElements(
    elements: TimelineElement[]
  ): Promise<TimelineElement[]> {
    const normalizedElements = elements.map((el) =>
      this.normalizeTimelineElement(el)
    );
    return normalizedElements;
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
