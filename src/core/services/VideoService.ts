import { Scene } from "phaser";
import { SyncSystem, SyncGroup } from "../animation/SyncSystem";
import {
  AnimationPropertyType,
  AudioConfig,
  SequenceItem,
} from "../animation/types";
import { AssetService } from "./AssetService";
import {
  TimelineElement,
  TimelineJson,
} from "../../types/interfaces/TimelineInterfaces";
import { CountdownTimer } from "../../ui/CountdownTimer/CountdownTimer";
import {
  showMessage,
  createErrorMessage,
  createInfoMessage,
  createSuccessMessage,
} from "../../ui/ErrorModal/MessageModal";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";
import {
  AssetDisplayProperties,
  SpineState,
} from "@/types/interfaces/AssetInterfaces";

export class VideoService {
  private syncSystem: SyncSystem;
  private timelineData: TimelineJson | null = null;
  private activeSprites: Map<
    string,
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Container
    | Phaser.GameObjects.Particles.ParticleEmitter
    | Phaser.Sound.WebAudioSound
    | Phaser.GameObjects.Text
  > = new Map();
  private countdownTimer: CountdownTimer | null = null;
  testSpine: SpineGameObject | null | undefined;
  private currentWidth: number; // New variable for current resolution
  private currentHeight: number; // New variable for current resolution

  constructor(private scene: Scene, private assetService: AssetService) {
    this.syncSystem = new SyncSystem(scene);
    this.currentWidth = scene.scale.width; // Initial setup
    this.currentHeight = scene.scale.height; // Initial setup
    this.setupScene();
  }

  public handleResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void {
    console.log(`handleResize in video service`);
    // Update current resolution
    this.currentWidth = newWidth;
    this.currentHeight = newHeight;

    // Use AssetService's handleResize to adjust sprites
    this.assetService.handleResize(oldWidth, oldHeight, newWidth, newHeight);

    // Readjust the timeline
    this.initializeTimelineElements();
  }

  private async setupScene(): Promise<void> {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
    this.scene.cameras.main.setBounds(0, 0, 1920, 1080);
    this.scene.cameras.main.centerOn(960, 540);
    this.scene.cameras.main.setZoom(1);
  }

  public async loadTimelineWithDelay(file: File): Promise<void> {
    try {
      const fileContent = await file.text();
      const timeline = JSON.parse(fileContent) as TimelineJson;

      this.timelineData = timeline;

      // Update current resolution before loading
      this.currentWidth = this.scene.scale.width;
      this.currentHeight = this.scene.scale.height;
      console.log(
        `VideoService: Loading timeline with resolution ${this.currentWidth}x${this.currentHeight}`
      );

      await this.loadTimelineAssets();

      //this.countdownTimer = new CountdownTimer(this.scene);
      //await this.countdownTimer.start();

      await this.initializeTimelineElements(); // We'll pass the adjustments to this function
    } catch (error) {
      showMessage({
        isOpen: true,
        title: "Timeline Loading Error",
        messages: [
          createErrorMessage(
            error instanceof Error ? error.message : String(error)
          ),
        ],
      });

      if (this.countdownTimer) {
        this.countdownTimer.destroy();
      }
      throw error;
    }
  }

  private async loadTimelineAssets(): Promise<void> {
    if (!this.timelineData) {
      return;
    }

    const assetsToLoad = this.timelineData["template video json"]
      .map((element) => element.assetName)
      .filter(Boolean);

    console.log("VideoService: Assets to load:", assetsToLoad);

    const loadResults = await Promise.all(
      assetsToLoad.map(async (assetName) => {
        const result = await this.assetService.loadAsset(assetName);
        return { assetName, result };
      })
    );

    const failedAssets = loadResults.filter(({ result }) => !result.success);
    if (failedAssets.length > 0) {
      console.error("VideoService: Failed assets:", failedAssets);
    }

    const allLoaded = loadResults.every(({ result }) => result.success);
    if (!allLoaded) {
      console.error(
        `VideoService: Failed assets:`,
        loadResults.filter(({ result }) => !result.success)
      );
    }
  }

  private calculateUniformScale(
    assetName: string,
    baseScaleX: number,
    baseScaleY: number,
    widthRatio: number,
    heightRatio: number
  ): { x: number; y: number } {
    const assetInfo = this.assetService.getAssetInfo(assetName);

    // Get initial Scale from scale_override or baseScale
    let adjustedScaleX =
      (assetInfo?.scale_override?.x ?? baseScaleX) * widthRatio;
    let adjustedScaleY =
      (assetInfo?.scale_override?.y ?? baseScaleY) * heightRatio;

    // Calculate Aspect Ratio
    let aspectRatio = 1;
    if (assetInfo?.aspect_ratio_override) {
      const { width, height } = assetInfo.aspect_ratio_override;
      aspectRatio = width / height;
      console.log(
        `Using aspect_ratio_override for ${assetName}: ${aspectRatio}`
      );

      // Adjust the Scale to the Aspect Ratio, using the smaller axis as the base
      const minScale = Math.min(adjustedScaleX, adjustedScaleY);
      if (aspectRatio > 1) {
        adjustedScaleX = minScale * aspectRatio;
        adjustedScaleY = minScale;
      } else {
        adjustedScaleX = minScale;
        adjustedScaleY = minScale / aspectRatio;
      }
      console.log(
        `Adjusted Scale for ${assetName} with aspect_ratio_override: x=${adjustedScaleX}, y=${adjustedScaleY}`
      );
    } else if (!assetInfo?.scale_override) {
      const sprite = this.assetService.getElementSprite(assetName);
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Image
      ) {
        aspectRatio = sprite.width / sprite.height;
        console.log(
          `Using sprite aspect ratio for ${assetName}: ${aspectRatio} (${sprite.width}/${sprite.height})`
        );
      } else {
        console.warn(
          `No aspect ratio info for ${assetName}, defaulting to 1:1`
        );
      }

      // Adjust to sprite's Aspect Ratio only if there is no scale_override
      if (aspectRatio > 1) {
        adjustedScaleX = adjustedScaleY * aspectRatio;
      } else {
        adjustedScaleY = adjustedScaleX / aspectRatio;
      }
    } else {
      console.log(
        `Using scale_override for ${assetName} without aspect ratio adjustment: x=${adjustedScaleX}, y=${adjustedScaleY}`
      );
    }

    console.log(
      `Calculated Scale for ${assetName}: x=${adjustedScaleX}, y=${adjustedScaleY}, aspectRatio=${aspectRatio}`
    );
    return { x: adjustedScaleX, y: adjustedScaleY };
  }

  private convertTimelineToAnimations(
    timelineElement: TimelineElement
  ): SequenceItem[] {
    const sequence: SequenceItem[] = [];
    const timeline = timelineElement.timeline;

    let sprite = this.activeSprites.get(timelineElement.elementName);

    if (!sprite && timelineElement.assetType !== "audio") {
      console.warn(
        `VideoService: No sprite found for ${timelineElement.elementName}`
      );
      return sequence;
    }

    let targetSprite = sprite;
    if (sprite instanceof Phaser.GameObjects.Container) {
      targetSprite = sprite.getAt(0) as
        | Phaser.GameObjects.Sprite
        | Phaser.GameObjects.Video
        | SpineGameObject;
    }

    // Use the current resolution that was saved
    const screenWidth = this.currentWidth;
    const screenHeight = this.currentHeight;

    // Log to check values
    console.log(
      `Converting timeline for ${timelineElement.elementName} with resolution ${screenWidth}x${screenHeight}`
    );

    // Handle audio
    if (
      timelineElement.assetType === "audio" ||
      timeline?.play ||
      timeline?.volume
    ) {
      if (!(sprite instanceof Phaser.Sound.WebAudioSound)) {
        const audioKey = timelineElement.assetName;
        let sound = this.scene.sound.get(audioKey);
        if (!sound) {
          sound = this.scene.sound.add(audioKey, {
            volume: timelineElement.initialState?.volume || 0.5,
            loop: timelineElement.initialState?.loop === true,
          });
        }
        sprite = sound as Phaser.Sound.WebAudioSound;
        this.activeSprites.set(timelineElement.elementName, sprite);
      }

      if (timeline?.play) {
        timeline.play.forEach((playConfig) => {
          sequence.push({
            type: "audio",
            config: {
              property: "audio",
              easing: playConfig.easeIn || "Linear",
              duration: (playConfig.endTime - playConfig.startTime) * 1000,
              delay: playConfig.startTime * 1000,
              audioKey: timelineElement.assetName,
              loop: playConfig.loop === "true",
            } as AudioConfig,
          });
        });
      }

      if (timeline?.volume && timeline.volume.length > 0) {
        timeline.volume.forEach((volumeConfig) => {
          sequence.push({
            type: "audio",
            config: {
              property: "audio",
              easing: volumeConfig.easeIn || "Linear",
              duration: (volumeConfig.endTime - volumeConfig.startTime) * 1000,
              delay: volumeConfig.startTime * 1000,
              audioKey: timelineElement.assetName,
              volume: {
                startValue: volumeConfig.startValue,
                endValue: volumeConfig.endValue,
              },
            } as AudioConfig,
          });
        });
      }
    }

    // Handle spine animations
    if (timeline?.animation) {
      timeline.animation.forEach((anim) => {
        sequence.push({
          type: "spine",
          config: {
            property: "spine",
            duration: (anim.endTime - anim.startTime) * 1000,
            easing: anim.easeIn || "Linear",
            delay: anim.startTime * 1000,
            startValue: undefined,
            endValue: undefined,
            animationName: anim.animationName,
            loop: String(anim.loop),
          },
        });
      });
    }

    // Handle text animations
    if (timelineElement.assetType === "text" && timeline?.text) {
      timeline.text.forEach(
        (textAnim: {
          value: any;
          fontSize: { startValue: any; endValue: any };
          color: { startValue: any; endValue: any };
          fontWeight: any;
          fontStyle: any;
          textDecoration: any;
          easeIn: any;
          endTime: number;
          startTime: number;
        }) => {
          const assetData = this.assetService.getFontFamily(
            timelineElement.assetName
          );
          const fontName = assetData || "Arial";
          sequence.push({
            type: "text",
            config: {
              property: "text",
              textValue: textAnim.value,
              fontSize: textAnim.fontSize
                ? {
                    startValue: textAnim.fontSize.startValue,
                    endValue: textAnim.fontSize.endValue,
                  }
                : undefined,
              color: textAnim.color
                ? {
                    startValue: textAnim.color.startValue,
                    endValue: textAnim.color.endValue,
                  }
                : undefined,
              fontWeight: textAnim.fontWeight,
              fontStyle: textAnim.fontStyle,
              textDecoration: textAnim.textDecoration,
              easing: textAnim.easeIn || "Linear",
              duration: (textAnim.endTime - textAnim.startTime) * 1000,
              delay: textAnim.startTime * 1000,
              assetName: timelineElement.assetName,
              fontName: fontName,
            },
          });
        }
      );

      let lastTextEndTime = 0;
      timeline.text.forEach((textAnim: { endTime: number }) => {
        if (textAnim.endTime > lastTextEndTime) {
          lastTextEndTime = textAnim.endTime;
        }
      });

      const hasMatchingOpacity = timeline?.opacity?.some(
        (opacityAnim) =>
          opacityAnim.endTime === lastTextEndTime && opacityAnim.endValue === 0
      );
      if (!hasMatchingOpacity && lastTextEndTime > 0) {
        sequence.push({
          type: "opacity",
          config: {
            property: "opacity",
            startValue: 1,
            endValue: 0,
            duration: 0,
            easing: "Linear",
            delay: lastTextEndTime * 1000,
          },
        });
      }
    }

    // Handle position
    if (timeline?.position) {
      timeline.position.forEach((positionAnim) => {
        const startZ =
          positionAnim.startValue.z ??
          timelineElement.initialState?.position?.z ??
          0;
        const endZ = positionAnim.endValue.z ?? startZ;

        sequence.push({
          type: "position",
          config: {
            property: "position",
            startValue: {
              x: positionAnim.startValue.x,
              y: positionAnim.startValue.y,
              z: startZ,
            },
            endValue: {
              x: positionAnim.endValue.x,
              y: positionAnim.endValue.y,
              z: endZ,
            },
            duration: (positionAnim.endTime - positionAnim.startTime) * 1000,
            easing: positionAnim.easeIn || "Linear",
            delay: positionAnim.startTime * 1000,
          },
        });
        console.log(
          `Position for ${timelineElement.elementName}: Start (${positionAnim.startValue.x}, ${positionAnim.startValue.y}, z:${startZ}), End (${positionAnim.endValue.x}, ${positionAnim.endValue.y}, z:${endZ}), Time: ${positionAnim.startTime}-${positionAnim.endTime}`
        );
      });
    }

    // Handle opacity
    if (timeline?.opacity) {
      const opacityAnim = timeline.opacity[0];
      sequence.push({
        type: "opacity",
        config: {
          property: "opacity",
          startValue: opacityAnim.startValue,
          endValue: opacityAnim.endValue,
          duration: (opacityAnim.endTime - opacityAnim.startTime) * 1000,
          easing: opacityAnim.easeIn || "Linear",
          delay: opacityAnim.startTime * 1000,
        },
      });
    }

    // Handle scale
    if (timeline?.scale) {
      const assetInfo = this.assetService.getAssetInfo(
        timelineElement.assetName
      );
      if (assetInfo?.scale_override) {
        console.log(
          `Ignoring timeline scale for ${timelineElement.elementName} due to scale_override: x=${assetInfo.scale_override.x}, y=${assetInfo.scale_override.y}`
        );
      } else {
        const isSupported =
          targetSprite instanceof Phaser.GameObjects.Sprite ||
          targetSprite instanceof Phaser.GameObjects.Video ||
          targetSprite instanceof SpineGameObject ||
          targetSprite instanceof Phaser.GameObjects.Text;

        if (isSupported) {
          const scaleAnim = timeline.scale[0];
          sequence.push({
            type: "scale",
            config: {
              property: "scale",
              startValue: scaleAnim.startValue,
              endValue: scaleAnim.endValue,
              duration: (scaleAnim.endTime - scaleAnim.startTime) * 1000,
              easing: scaleAnim.easeIn || "Linear",
              delay: scaleAnim.startTime * 1000,
            },
          });
          console.log(
            `Scale for ${timelineElement.elementName}: Start (${scaleAnim.startValue.x}, ${scaleAnim.startValue.y}), End (${scaleAnim.endValue.x}, ${scaleAnim.endValue.y})`
          );
        }
      }
    }

    // Handle rotation
    if (timeline?.rotation) {
      const isSupported =
        targetSprite instanceof Phaser.GameObjects.Sprite ||
        targetSprite instanceof SpineGameObject ||
        targetSprite instanceof Phaser.GameObjects.Text;

      if (isSupported) {
        sequence.push({
          type: "rotation",
          config: {
            property: "rotation",
            startValue: timeline.rotation[0].startValue,
            endValue: timeline.rotation[0].endValue,
            duration:
              (timeline.rotation[0].endTime - timeline.rotation[0].startTime) *
              1000,
            easing: timeline.rotation[0].easeIn || "Linear",
            delay: timeline.rotation[0].startTime * 1000,
          },
        });
      }
    }

    // Handle color
    if (timeline?.color) {
      const isSupported =
        targetSprite instanceof Phaser.GameObjects.Sprite ||
        targetSprite instanceof SpineGameObject ||
        targetSprite instanceof Phaser.GameObjects.Text;

      if (isSupported) {
        sequence.push({
          type: "color",
          config: {
            property: "color",
            startValue: timeline.color[0].startValue,
            endValue: timeline.color[0].endValue,
            duration:
              (timeline.color[0].endTime - timeline.color[0].startTime) * 1000,
            easing: timeline.color[0].easeIn || "Linear",
            delay: timeline.color[0].startTime * 1000,
          },
        });
      }
    }

    return sequence;
  }

  public async handleResolutionChange(): Promise<void> {
    console.log("VideoService: Handling resolution change - clearing assets");

    // Filter GameObjects that can be sent to stopAll
    const gameObjects = [...this.activeSprites.values()].filter(
      (sprite) =>
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
    ) as Phaser.GameObjects.GameObject[];

    // Stop all animations for GameObjects
    if (gameObjects.length > 0) {
      this.syncSystem.stopAll(gameObjects);
    }

    // Destroy all assets (sprites, sound etc.)
    this.activeSprites.forEach((sprite) => {
      if (sprite instanceof Phaser.Sound.WebAudioSound) {
        sprite.stop();
        sprite.destroy();
      } else {
        sprite.destroy();
      }
    });
    this.activeSprites.clear();

    // Clear the timeline and timer only, without resetting the syncSystem or scene
    this.timelineData = null;
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    // Update current resolution
    this.currentWidth = this.scene.scale.width;
    this.currentHeight = this.scene.scale.height;

    console.log(
      `VideoService: Assets cleared, ready for new timeline at resolution ${this.currentWidth}x${this.currentHeight}`
    );
  }

  private async initializeTimelineElements(): Promise<void> {
    if (!this.timelineData) {
      return;
    }
    const syncGroups: SyncGroup[] = [];
    const activeElements = new Set<string>();
    const baseWidth = 1920;
    const baseHeight = 1080;

    for (const element of this.timelineData["template video json"]) {
      if (!element.initialState) {
        continue;
      }

      activeElements.add(element.elementName);

      let sprite = this.activeSprites.get(element.elementName);
      const widthRatio = this.currentWidth / baseWidth;
      const heightRatio = this.currentHeight / baseHeight;

      const assetInfo = this.assetService.getAssetInfo(element.assetName);
      let scaleX: number, scaleY: number;

      // Check if there's a timeline.scale and no scale_override
      if (element.timeline?.scale && !assetInfo?.scale_override) {
        const timelineScale = element.timeline.scale[0]; // Take the first scale animation
        scaleX = timelineScale.startValue.x;
        scaleY = timelineScale.startValue.y;
        console.log(
          `Using timeline.scale.startValue for ${element.elementName}: x=${scaleX}, y=${scaleY}`
        );
      } else {
        // Fallback to scale_override or uniformScale
        const uniformScale = this.calculateUniformScale(
          element.assetName,
          element.initialState.scale?.x ?? 1,
          element.initialState.scale?.y ?? 1,
          widthRatio,
          heightRatio
        );
        scaleX = assetInfo?.scale_override?.x ?? uniformScale.x;
        scaleY = assetInfo?.scale_override?.y ?? uniformScale.y;
      }

      const adjustedInitialState: AssetDisplayProperties = {
        x: element.initialState?.position?.x
          ? element.initialState.position.x * widthRatio
          : this.currentWidth / 2,
        y: element.initialState?.position?.y
          ? element.initialState.position.y * heightRatio
          : this.currentHeight / 2,
        scaleX: scaleX,
        scaleY: scaleY,
        alpha: element.initialState?.opacity ?? 1,
        rotation: element.initialState?.rotation ?? 0,
        tint: element.initialState?.color
          ? parseInt(element.initialState.color.replace("#", ""), 16)
          : undefined,
        ratio: assetInfo?.aspect_ratio_override,
        assetName: element.assetName,
        timelineScale: undefined,
      };

      if (!sprite) {
        sprite = this.assetService.displayElement(
          element.assetName,
          adjustedInitialState,
          element.elementName
        );
        this.activeSprites.set(element.elementName, sprite);
      }

      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Image
      ) {
        sprite.setDepth(element.initialState.position?.z ?? 0);
        sprite.setVisible(true);
      }

      if (element.timeline) {
        const adjustedTimeline = this.adjustTimeline(
          element.timeline,
          widthRatio,
          heightRatio,
          element.assetName,
          element
        );
        const sequence = this.convertTimelineToAnimations({
          ...element,
          timeline: adjustedTimeline,
        });
        if (sequence.length > 0 && sprite) {
          syncGroups.push({
            target: sprite,
            sequence,
          });
        }
      }

      if (element.assetType === "audio") {
        if (!sprite || !(sprite instanceof Phaser.Sound.WebAudioSound)) {
          sprite = this.assetService.displayElement(
            element.assetName,
            adjustedInitialState,
            element.elementName
          );
          this.activeSprites.set(element.elementName, sprite);
        }
      } else if (element.assetType === "text") {
        // Use displayAsset with full adjustedInitialState
        sprite = this.assetService.displayElement(
          element.assetName,
          {
            ...adjustedInitialState,
            text: element.initialState.text ?? "", // Default value for text
            fontSize: adjustedInitialState.fontSize ?? "32px", // Default value
            color: adjustedInitialState.color ?? "#ffffff", // Default value
            fontStyle: adjustedInitialState.fontStyle ?? "normal", // Default value
            fontWeight: adjustedInitialState.fontWeight ?? "normal", // Default value
            textDecoration: adjustedInitialState.textDecoration ?? undefined,
          },
          element.elementName
        );
        this.activeSprites.set(element.elementName, sprite);
      } else if (!sprite) {
        sprite = this.assetService.displayElement(
          element.assetName,
          adjustedInitialState,
          element.elementName
        );
        this.activeSprites.set(element.elementName, sprite);
      }

      // Set depth
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Image ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter ||
        sprite instanceof Phaser.GameObjects.Text
      ) {
        sprite.setDepth(element.initialState.position?.z ?? 0);
        sprite.setVisible(true);
      }

      if (element.timeline) {
        const adjustedTimeline = this.adjustTimeline(
          element.timeline,
          widthRatio,
          heightRatio,
          element.assetName,
          element
        );
        const sequence = this.convertTimelineToAnimations({
          ...element,
          timeline: adjustedTimeline,
        });
        if (sequence.length > 0 && sprite) {
          syncGroups.push({
            target: sprite,
            sequence,
          });
        }
      }
    }

    // Hide inactive elements
    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Image ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter ||
          sprite instanceof Phaser.GameObjects.Text
        ) {
          sprite.setVisible(false);
        }
      }
    }

    if (syncGroups.length > 0) {
      await this.syncSystem.playSync(syncGroups);
    }
  }

  // New function to adjust timeline to resolution
  private adjustTimeline(
    timeline: any,
    widthRatio: number,
    heightRatio: number,
    assetName: string,
    element: TimelineElement
  ): any {
    const adjustedTimeline = { ...timeline };
    const assetInfo = this.assetService.getAssetInfo(assetName);

    if (adjustedTimeline.position) {
      const initialX = element.initialState?.position?.x ?? 0;
      const initialY = element.initialState?.position?.y ?? 0;
      const initialZ = element.initialState?.position?.z ?? 0;

      adjustedTimeline.position = adjustedTimeline.position.map(
        (pos: any, index: number) => {
          const previousX =
            index > 0
              ? adjustedTimeline.position[index - 1].endValue.x
              : initialX;
          const previousY =
            index > 0
              ? adjustedTimeline.position[index - 1].endValue.y
              : initialY;
          const previousZ =
            index > 0
              ? adjustedTimeline.position[index - 1].endValue.z
              : initialZ;

          return {
            ...pos,
            startValue: {
              x:
                pos.startValue.x !== undefined
                  ? pos.startValue.x * widthRatio
                  : previousX * widthRatio,
              y:
                pos.startValue.y !== undefined
                  ? pos.startValue.y * heightRatio
                  : previousY * heightRatio,
              z: pos.startValue.z !== undefined ? pos.startValue.z : previousZ,
            },
            endValue: {
              x:
                pos.endValue.x !== undefined
                  ? pos.endValue.x * widthRatio
                  : pos.startValue.x !== undefined
                  ? pos.startValue.x * widthRatio
                  : previousX * widthRatio,
              y:
                pos.endValue.y !== undefined
                  ? pos.endValue.y * heightRatio
                  : pos.startValue.y !== undefined
                  ? pos.startValue.y * heightRatio
                  : previousY * heightRatio,
              z:
                pos.endValue.z !== undefined
                  ? pos.endValue.z
                  : pos.startValue.z !== undefined
                  ? pos.startValue.z
                  : previousZ,
            },
          };
        }
      );
    }

    if (adjustedTimeline.scale) {
      if (assetInfo?.scale_override) {
        console.log(
          `Scale override applied for ${assetName}, timeline scale will be ignored`
        );
        delete adjustedTimeline.scale; // Ignore timeline scale if scale_override exists
      } else {
        // If timeline.scale is used as initial scale, we might not need to animate it unless it changes
        adjustedTimeline.scale = adjustedTimeline.scale.map((scale: any) => {
          const uniformScaleStart = this.calculateUniformScale(
            assetName,
            scale.startValue.x,
            scale.startValue.y,
            widthRatio,
            heightRatio
          );
          const uniformScaleEnd = this.calculateUniformScale(
            assetName,
            scale.endValue.x,
            scale.endValue.y,
            widthRatio,
            heightRatio
          );
          return {
            ...scale,
            startValue: uniformScaleStart,
            endValue: uniformScaleEnd,
          };
        });
      }
    }

    return adjustedTimeline;
  }

  public pauseAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        this.syncSystem.pauseAll([sprite]);
      }
    });
  }

  public resumeAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        this.syncSystem.resumeAll([sprite]);
      }
    });
  }

  public stopAllAnimations(): void {
    this.activeSprites.forEach((sprite, name) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        this.syncSystem.stopAll([sprite]);
      }
    });
  }

  public getActiveSprites(): Map<
    string,
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Container
  > {
    const filteredMap = new Map<
      string,
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Video
      | SpineGameObject
      | Phaser.GameObjects.Container
    >();
    this.activeSprites.forEach((sprite, key) => {
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container
      ) {
        filteredMap.set(key, sprite);
      }
    });
    return filteredMap;
  }

  // Add this method to VideoService class
  public async clearAllAssets(): Promise<void> {
    console.log("VideoService: Clearing all video assets");
    await this.assetService.reset(); // נוסף
    this.stopAllAnimations();

    this.stopAllVideos();

    this.activeSprites.forEach((sprite, elementName) => {
      try {
        console.log(`VideoService: Destroying sprite ${elementName}`);

        if (sprite instanceof Phaser.Sound.WebAudioSound) {
          sprite.stop();
          sprite.destroy();
        } else if (sprite instanceof Phaser.GameObjects.Container) {
          sprite.removeAll(true);
          sprite.destroy();
        } else {
          if (sprite.destroy) {
            sprite.destroy();
          } else {
            this.scene.children.remove(sprite);
          }
        }
      } catch (e) {
        console.warn(`Error destroying sprite ${elementName}:`, e);
      }
    });

    this.activeSprites.clear();

    this.timelineData = null;

    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    console.log("VideoService: All assets cleared successfully");
  }

  // Helper methods that might be needed
  private stopAllVideos(): void {
    console.log("VideoService: Stopping all active videos");

    this.activeSprites.forEach((sprite, elementName) => {
      if (sprite instanceof Phaser.GameObjects.Video) {
        sprite.stop();
        console.log(`Stopped video: ${elementName}`);
      }

      if (sprite instanceof Phaser.GameObjects.Container) {
        const children = sprite.getAll();
        children.forEach((child) => {
          if (child instanceof Phaser.GameObjects.Video) {
            child.stop();
            console.log(`Stopped video inside container: ${elementName}`);
          }
        });
      }
    });
  }

  private clearCache(): void {
    console.log("VideoService: Clearing video cache");

    this.timelineData = null;

    console.log(
      "VideoService: Skipping texture cache clearing to avoid errors"
    );
  }

  private resetState(): void {
    console.log("VideoService: Resetting internal state");

    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    this.activeSprites.clear();
  }
}
