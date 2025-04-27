import { Display, Scene } from "phaser";
import { SyncSystem, SyncGroup } from "../animation/SyncSystem";
import {
  AnimationPropertyType,
  AudioConfig,
  SequenceItem,
} from "../animation/types";
import { AssetService } from "./AssetService";
import { TimelineService } from "./TimelineService";
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
  AssetInfo,
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
  private currentWidth: number;
  private currentHeight: number;
  private timelineService: TimelineService;

  constructor(
    private scene: Scene,
    private assetService: AssetService,
    assetsMap: Map<string, { url: string; type: string }>
  ) {
    this.syncSystem = new SyncSystem(scene);
    this.currentWidth = scene.scale.width;
    this.currentHeight = scene.scale.height;
    this.timelineService = new TimelineService(assetsMap, assetService, scene);
    this.setupScene();
  }

  /**
   * Handle resolution changes by updating dimensions and re-initializing elements
   */
  public handleResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void {
    console.log(`handleResize in VideoService`);
    this.currentWidth = newWidth;
    this.currentHeight = newHeight;
    this.initializeTimelineElements();
  }

  /**
   * Setup the initial scene configuration
   */
  private async setupScene(): Promise<void> {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
    this.scene.cameras.main.setBounds(0, 0, 1920, 1080);
    this.scene.cameras.main.centerOn(960, 540);
    this.scene.cameras.main.setZoom(1);
  }

  /**
   * Load a timeline file and initialize its assets and elements
   */
  public async loadTimelineWithDelay(file: File): Promise<void> {
    try {
      const fileContent = await file.text();
      const timeline = JSON.parse(fileContent) as TimelineJson;

      this.timelineData = timeline;
      this.currentWidth = this.scene.scale.width;
      this.currentHeight = this.scene.scale.height;

      await this.loadTimelineAssets();
      await this.initializeTimelineElements();
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

  /**
   * Load all assets referenced in the timeline
   */
  private async loadTimelineAssets(): Promise<void> {
    if (!this.timelineData) return;

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
  }

  /**
   * Calculate uniform scale for an asset, maintaining aspect ratio
   */
  private calculateUniformScale(
    assetName: string,
    baseScaleX: number,
    baseScaleY: number,
    widthRatio: number,
    heightRatio: number,
    sprite: any
  ): { x: number; y: number } {
    const assetInfo = this.assetService.getAssetInfo(assetName);
    let initialScaleX =
      (assetInfo?.scale_override?.x ?? baseScaleX) * widthRatio;
    let initialScaleY =
      (assetInfo?.scale_override?.y ?? baseScaleY) * heightRatio;

    let adjustedScaleX: number;
    let adjustedScaleY: number;

    if (assetInfo?.aspect_ratio_override) {
      // If the asset has aspect ratio override, use it to calculate the scale
      const { width, height } = assetInfo.aspect_ratio_override;
      const aspectRatio = width / height;
      const baseScaleAbs = Math.min(
        Math.abs(initialScaleX),
        Math.abs(initialScaleY)
      );
      const signX = initialScaleX >= 0 ? 1 : -1;
      const signY = initialScaleY >= 0 ? 1 : -1;

      if (aspectRatio > 1) {
        adjustedScaleX = signX * baseScaleAbs * aspectRatio;
        adjustedScaleY = signY * baseScaleAbs;
      } else {
        adjustedScaleX = signX * baseScaleAbs;
        adjustedScaleY = (signY * baseScaleAbs) / aspectRatio;
      }
    } else {
      adjustedScaleX = initialScaleX;
      adjustedScaleY = initialScaleY;

      // If no scale override is provided, calculate based on sprite dimensions
      if (!assetInfo?.scale_override && sprite) {
        let aspectRatio = 1;
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof Phaser.GameObjects.Text
        ) {
          aspectRatio = sprite.width / sprite.height;
        } else if (sprite instanceof SpineGameObject) {
          sprite.setVisible(false);
          const spineWidth = sprite.skeleton?.data?.width || 1;
          const spineHeight = sprite.skeleton?.data?.height || 1;
          aspectRatio = spineWidth / spineHeight;
        }
        const minScale = Math.min(adjustedScaleX, adjustedScaleY);
        if (aspectRatio > 1) {
          adjustedScaleX = minScale * aspectRatio;
          adjustedScaleY = minScale;
        } else {
          adjustedScaleX = minScale;
          adjustedScaleY = minScale / aspectRatio;
        }
      }
    }

    return { x: adjustedScaleX, y: adjustedScaleY };
  }

  /**
   * Convert timeline animations to sequence items for the SyncSystem
   */
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

    const screenWidth = this.currentWidth;
    const screenHeight = this.currentHeight;
    const widthRatio = this.currentWidth / 1920;
    const heightRatio = this.currentHeight / 1080;

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

    // Handle TimelineElement.onScreen
    if (timelineElement.onScreen) {
      timelineElement.onScreen.forEach(
        (onScreenItem: { time: number; value: boolean }) => {
          sequence.push({
            type: "visibility",
            config: {
              property: "visibility",
              startValue: onScreenItem.value,
              endValue: onScreenItem.value,
              duration: 0,
              easing: "Linear", // Added for AnimationConfig
              delay: onScreenItem.time * 1000,
            },
            delay: onScreenItem.time * 1000,
          });
        }
      );
    }

    // Handle timeline.onScreen as { time: number; value: boolean }[]
    if (timeline?.onScreen) {
      timeline.onScreen.forEach((anim) => {
        sequence.push({
          type: "visibility",
          config: {
            property: "visibility",
            startValue: anim.value,
            //endValue: anim.value,
            duration: 0,
            easing: "Linear",
            delay: anim.time * 1000, // Changed from anim.startTime to anim.time
          },
        });
      });
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

    // Handle position animations
    if (timeline?.position) {
      const hasAnchor = !!timelineElement.initialState?.anchor;
      const anchorX = timelineElement.initialState?.anchor?.x ?? 0.5;
      const anchorY = timelineElement.initialState?.anchor?.y ?? 0.5;

      timeline.position.forEach((positionAnim) => {
        const startZ =
          positionAnim.startValue.z ??
          timelineElement.initialState?.position?.z ??
          0;
        const endZ = positionAnim.endValue.z ?? startZ;

        let finalStartX: number;
        let finalStartY: number;
        let finalEndX: number;
        let finalEndY: number;

        if (hasAnchor) {
          // Calculate base position from anchor
          const baseX = anchorX * this.currentWidth;
          const baseY = anchorY * this.currentHeight;

          // Treat position values as offsets from anchor, scaled to resolution
          finalStartX = baseX + positionAnim.startValue.x * widthRatio;
          finalStartY = baseY + positionAnim.startValue.y * heightRatio;
          finalEndX = baseX + positionAnim.endValue.x * widthRatio;
          finalEndY = baseY + positionAnim.endValue.y * heightRatio;
        } else {
          // No anchor: scale absolute positions directly
          finalStartX = positionAnim.startValue.x * widthRatio;
          finalStartY = positionAnim.startValue.y * heightRatio;
          finalEndX = positionAnim.endValue.x * widthRatio;
          finalEndY = positionAnim.endValue.y * heightRatio;
        }

        console.log(
          `Timeline position for "${timelineElement.elementName}": ` +
            `Adjusted to (${finalStartX}, ${finalStartY}) -> (${finalEndX}, ${finalEndY})`
        );

        sequence.push({
          type: "position",
          config: {
            property: "position",
            startValue: {
              x: finalStartX,
              y: finalStartY,
              z: startZ,
            },
            endValue: {
              x: finalEndX,
              y: finalEndY,
              z: endZ,
            },
            duration: (positionAnim.endTime - positionAnim.startTime) * 1000,
            easing: positionAnim.easeIn || "Linear",
            delay: positionAnim.startTime * 1000,
          },
        });
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
      if (!assetInfo?.scale_override) {
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
        }
      }
    }

    if (timeline?.rotation) {
      const RotationAnimation = timeline.rotation[0];
      sequence.push({
        type: "rotation",
        config: {
          property: "rotation",
          startValue: RotationAnimation.startValue,
          endValue: RotationAnimation.endValue,
          duration:
            (RotationAnimation.endTime - RotationAnimation.startTime) * 1000,
          easing: RotationAnimation.easeIn || "Linear",
          delay: RotationAnimation.startTime * 1000,
        },
      });
    }

    return sequence;
  }

  /**
   * Position a SpineGameObject with adjusted pivot to center the origin.
   * @param spine The SpineGameObject to position.
   * @param element The timeline element data.
   * @param finalX The target X position.
   * @param finalY The target Y position.
   * @param scaleX The X scale.
   * @param scaleY The Y scale.
   * @param widthRatio The width scaling ratio.
   * @param heightRatio The height scaling ratio.
   */
  private positionSpineElement(
    spine: SpineGameObject,
    element: TimelineElement,
    finalX: number,
    finalY: number,
    scaleX: number,
    scaleY: number,
    widthRatio: number,
    heightRatio: number
  ): void {
    const assetInfo = this.assetService.getAssetInfo(element.assetName);
    const pivot = assetInfo?.pivot_override || { x: 0.5, y: 0.5 };

    // Get Spine dimensions from skeleton data
    const spineWidth = (spine.skeleton?.data?.width || 200) * scaleX; // Fallback to 200 if undefined
    const spineHeight = (spine.skeleton?.data?.height || 200) * scaleY; // Fallback to 200 if undefined

    // Get the relative position of the origin
    const { relativeX, relativeY } = this.getSpineOriginRelativePositionNumeric(
      spine,
      element.elementName
    );

    // Calculate the offset needed to center the origin (move relativeX and relativeY to 0.5)
    const offsetX = relativeX - 1; // Offset to center the origin horizontally
    const offsetY = relativeY - 1; // Offset to center the origin vertically

    // Adjust position to account for custom pivot with offset
    const adjustedX = finalX + (pivot.x + offsetX) * spineWidth; // Offset to center at finalX
    const adjustedY = finalY + (pivot.y + offsetY) * spineHeight; // Offset to center at finalY

    // Log positioning details for debugging
    console.log(
      `Positioning Spine ${element.elementName}: ` +
        `Final (${finalX}, ${finalY}), Adjusted (${adjustedX}, ${adjustedY}), ` +
        `Pivot (${pivot.x.toFixed(3)}, ${pivot.y.toFixed(3)}), ` +
        `Offset (${offsetX.toFixed(3)}, ${offsetY.toFixed(3)}), ` +
        `Relative (${relativeX.toFixed(3)}, ${relativeY.toFixed(3)}), ` +
        `Dimensions (${spineWidth}, ${spineHeight}), Scale (${scaleX}, ${scaleY})`
    );

    // Set position, origin, and scale
    spine.setPosition(adjustedX, adjustedY);
    //this is not working ye on spine - should be diskast with spine-company
    //spine.setOrigin(0.5, 0.5);
    spine.setScale(scaleX, scaleY);
    spine.setDepth(element.initialState?.position?.z ?? 0);

    // Debug the positioning
    //this.debugPivotAndAnchor(spine, element.elementName, finalX, finalY);
  }

  /**
   * Calculate the relative position of the Spine's origin (red dot from debugPivotAndAnchor)
   * with respect to the Spine's bounding box, returning normalized coordinates (0 to 1).
   * @param spine The SpineGameObject to analyze.
   * @param elementName The name of the element for logging purposes.
   * @returns An object with relativeX and relativeY (both between 0 and 1).
   */
  public getSpineOriginRelativePositionNumeric(
    spine: SpineGameObject,
    elementName: string
  ): { relativeX: number; relativeY: number } {
    // Get dimensions and scale
    const scaleX = spine.scaleX;
    const scaleY = spine.scaleY;
    const width = (spine.skeleton?.data?.width || 100) * scaleX; // Fallback to 100 if undefined
    const height = (spine.skeleton?.data?.height || 100) * scaleY; // Fallback to 100 if undefined

    // Get the origin point (red dot from debugPivotAndAnchor)
    const originX = spine.x;
    const originY = spine.y;

    // Calculate the bounding box boundaries
    const leftBound = spine.x - width * spine.originX;
    const rightBound = leftBound + width;
    const topBound = spine.y - height * spine.originY;
    const bottomBound = topBound + height;

    // Calculate the relative position of the origin within the bounding box
    const relativeX = (originX - leftBound) / width; // Normalize to 0-1
    const relativeY = (originY - topBound) / height; // Normalize to 0-1

    // Log the calculated positions for debugging
    console.log(
      `Spine ${elementName}: Origin at (${originX}, ${originY}), ` +
        `Bounding box [(${leftBound}, ${topBound}), (${rightBound}, ${bottomBound})], ` +
        `Relative position: (relativeX: ${relativeX.toFixed(
          3
        )}, relativeY: ${relativeY.toFixed(3)})`
    );

    return { relativeX, relativeY };
  }

  private drawDebugGrid(): void {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, 0x00ff00, 0.5);

    // Draw vertical lines every 100 pixels
    for (let x = 0; x <= this.currentWidth; x += 100) {
      graphics.lineBetween(x, 0, x, this.currentHeight);
      this.scene.add.text(x, 10, `${x}`, {
        color: "#ffffff",
        fontSize: "16px",
      });
    }

    // Draw horizontal lines every 100 pixels
    for (let y = 0; y <= this.currentHeight; y += 100) {
      graphics.lineBetween(0, y, this.currentWidth, y);
      this.scene.add.text(10, y, `${y}`, {
        color: "#ffffff",
        fontSize: "16px",
      });
    }

    // Highlight center of the screen
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(this.currentWidth / 2, this.currentHeight / 2, 10);
  }

  private debugPivotAndAnchor(
    sprite:
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Video
      | SpineGameObject
      | Phaser.GameObjects.Text,
    elementName: string,
    finalX: number,
    finalY: number
  ): void {
    // Create a graphics object for debugging
    const graphics = this.scene.add.graphics();

    // Get dimensions and scale
    let width: number, height: number;
    const scaleX = sprite.scaleX;
    const scaleY = sprite.scaleY;

    if (sprite instanceof SpineGameObject) {
      sprite.setVisible(false);
      width = (sprite.skeleton?.data?.width || 100) * scaleX;
      height = (sprite.skeleton?.data?.height || 100) * scaleY;
    } else {
      width = sprite.width * scaleX;
      height = sprite.height * scaleY;
    }

    // Calculate the origin point (based on pivot)
    const originX = sprite.x;
    const originY = sprite.y;

    // Calculate the center point of the bounding box
    const centerX = sprite.x - width * (sprite.originX - 0.5);
    const centerY = sprite.y - height * (sprite.originY - 0.5);

    // Draw a red dot at the origin (pivot)
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(originX, originY, 5);

    // Draw a blue dot at the center of the bounding box
    graphics.fillStyle(0x0000ff, 1);
    graphics.fillCircle(centerX, centerY, 5);

    // Draw a yellow dot at the anchor position (finalX, finalY before pivot adjustment)
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(finalX, finalY, 5);

    // Draw a green rectangle around the bounding box
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeRect(
      sprite.x - width * sprite.originX,
      sprite.y - height * sprite.originY,
      width,
      height
    );

    // Optional: Destroy graphics after a few seconds for temporary debugging
    // this.scene.time.delayedCall(5000, () => {
    //   graphics.destroy();
    // });
  }

  private debugSpineCenter(spine: SpineGameObject): void {
    // Create a graphics object for debugging
    const graphics = this.scene.add.graphics();

    // Get the dimensions of the Spine object from skeleton data
    const scaleX = spine.scaleX;
    const scaleY = spine.scaleY;
    const width = (spine.skeleton?.data?.width || 100) * scaleX;
    const height = (spine.skeleton?.data?.height || 100) * scaleY;

    // Calculate the origin point in world coordinates
    const originX = spine.x;
    const originY = spine.y;

    // Calculate the center point of the Spine's bounding box
    const centerX = spine.x - width * (spine.originX - 0.5);
    const centerY = spine.y - height * (spine.originY - 0.5);

    // Draw a red dot at the origin
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(originX, originY, 5);

    // Draw a blue dot at the center of the bounding box
    graphics.fillStyle(0x0000ff, 1);
    graphics.fillCircle(centerX, centerY, 5);

    // Draw a green rectangle around the Spine bounds
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeRect(
      spine.x - width * spine.originX,
      spine.y - height * spine.originY,
      width,
      height
    );

    // Optional: Destroy graphics after a few seconds for temporary debugging
    this.scene.time.delayedCall(5000, () => {
      graphics.destroy();
    });
  }
  // Add debug visualization for SpineGameObject position and origin
  private debugSpinePosition(spine: SpineGameObject): void {
    // Create a graphics object for debugging
    const graphics = this.scene.add.graphics();

    // Get the dimensions of the Spine object from skeleton data
    const scaleX = spine.scaleX;
    const scaleY = spine.scaleY;
    const width = (spine.skeleton?.data?.width || 100) * scaleX;
    const height = (spine.skeleton?.data?.height || 100) * scaleY;

    // Calculate the origin point in world coordinates
    const originX = spine.x;
    const originY = spine.y;

    // Draw a red dot at the origin
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(originX, originY, 5);

    // Draw a green rectangle around the Spine bounds, adjusted for origin
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeRect(
      spine.x - width * spine.originX,
      spine.y - height * spine.originY,
      width,
      height
    );

    // Optional: Destroy graphics after a few seconds for temporary debugging
    // this.scene.time.delayedCall(5000, () => {
    //   graphics.destroy();
    // });
  }

  // Initialize all elements from the timeline data
  private async initializeTimelineElements(): Promise<void> {
    if (!this.timelineData) return;

    const syncGroups: SyncGroup[] = [];
    const activeElements = new Set<string>();
    const baseWidth = 1920;
    const baseHeight = 1080;
    const widthRatio = this.currentWidth / baseWidth;
    const heightRatio = this.currentHeight / baseHeight;

    console.log(
      `Initializing with resolution ${this.currentWidth}x${this.currentHeight}, ratios: (${widthRatio}, ${heightRatio})`
    );

    const normalizedElements =
      await this.timelineService.processTimelineElements(
        this.timelineData["template video json"]
      );

    // Create a map of original elements for lookup
    const originalElementsMap = new Map<string, TimelineElement>();
    this.timelineData["template video json"].forEach((element) => {
      originalElementsMap.set(element.elementName, element);
    });

    for (const normalizedElement of normalizedElements) {
      if (!normalizedElement.initialState) continue;

      // Get the original element from the JSON
      const originalElement = originalElementsMap.get(
        normalizedElement.elementName
      );
      const originalPositionX = originalElement?.initialState?.position?.x ?? 0;
      const originalPositionY = originalElement?.initialState?.position?.y ?? 0;
      const hasAnchor = !!normalizedElement.initialState?.anchor;
      const anchorX = normalizedElement.initialState?.anchor?.x ?? 0.5;
      const anchorY = normalizedElement.initialState?.anchor?.y ?? 0.5;

      // Calculate final position using anchor
      let finalX: number;
      let finalY: number;

      if (hasAnchor) {
        const baseX = anchorX * this.currentWidth;
        const baseY = anchorY * this.currentHeight;
        finalX = baseX + originalPositionX * widthRatio;
        finalY = baseY + originalPositionY * heightRatio;
      } else {
        const positionX = normalizedElement.initialState?.position?.x ?? 0;
        const positionY = normalizedElement.initialState?.position?.y ?? 0;
        finalX = positionX * widthRatio;
        finalY = positionY * heightRatio;
      }

      activeElements.add(normalizedElement.elementName);
      let sprite = this.activeSprites.get(normalizedElement.elementName);
      const assetInfo = this.assetService.getAssetInfo(
        normalizedElement.assetName
      );

      // Calculate scale with aspect ratio preservation
      const uniformScale = this.calculateUniformScale(
        normalizedElement.assetName,
        normalizedElement.initialState?.scale?.x ?? 1,
        normalizedElement.initialState?.scale?.y ?? 1,
        widthRatio,
        heightRatio,
        sprite
      );

      const scaleX = assetInfo?.aspect_ratio_override
        ? uniformScale.x
        : assetInfo?.scale_override?.x ?? uniformScale.x;
      const scaleY = assetInfo?.aspect_ratio_override
        ? uniformScale.y
        : assetInfo?.scale_override?.y ?? uniformScale.y;

      const pivot = assetInfo?.pivot_override || { x: 0.5, y: 0.5 };

      // Prepare display properties for the asset
      const initialState: AssetDisplayProperties = {
        x: finalX,
        y: finalY,
        scaleX: scaleX,
        scaleY: scaleY,
        alpha: normalizedElement.initialState?.opacity ?? 0,
        rotation: normalizedElement.initialState?.rotation ?? 0,
        tint: normalizedElement.initialState?.color
          ? parseInt(normalizedElement.initialState.color.replace("#", ""), 16)
          : undefined,
        ratio: assetInfo?.aspect_ratio_override,
        assetName: normalizedElement.assetName,
        pivot: pivot,
        timelineScale: undefined,
        visible: false, // Always hidden by default
      };

      // Check onScreen for initial visibility (only at time 0)
      let initialVisible = false;
      if (originalElement?.onScreen) {
        const firstOnScreen = originalElement.onScreen.find(
          (item: { time: number; value: boolean }) => item.time === 0
        );
        initialVisible = firstOnScreen ? firstOnScreen.value : false;
      }

      // Update initialState with visibility
      initialState.visible = initialVisible;

      // Log to debug visibility
      console.log(
        `Element ${normalizedElement.elementName}: onScreen at time 0=${
          initialVisible ? "visible" : "hidden"
        }`
      );

      //if (normalizedElement.assetType != "spine") {
      //  Display the element using asset service
      // sprite = this.assetService.displayElement(
      //   normalizedElement.assetName,
      //   initialState,
      //   normalizedElement.elementName
      // );

      const element = this.assetService.createElement(
        normalizedElement.assetName,
        assetInfo as AssetInfo,
        initialState
      );

      this.activeSprites.set(normalizedElement.elementName, element);
      // }

      sprite = element;
      // Set sprite properties based on type
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof Phaser.GameObjects.Text
      ) {
        const spriteWidth = sprite.width * scaleX;
        const spriteHeight = sprite.height * scaleY;
        sprite.setPosition(
          finalX - spriteWidth * (pivot.x - 0.5),
          finalY - spriteHeight * (pivot.y - 0.5)
        );
        sprite.setOrigin(pivot.x, pivot.y);
        sprite.setScale(scaleX, scaleY);
        sprite.setDepth(normalizedElement.initialState?.position?.z ?? 0);
        sprite.setVisible(initialVisible);
        sprite.setAlpha(initialState.alpha);
      }

      if (sprite instanceof SpineGameObject) {
        sprite.setAlpha(initialState.alpha);
        this.positionSpineElement(
          sprite,
          normalizedElement,
          finalX,
          finalY,
          scaleX,
          scaleY,
          widthRatio,
          heightRatio
        );

        sprite.setVisible(false); // Set visibility explicitly
        // Log final state
        console.log(
          `Element ${normalizedElement.elementName}: Final Visible=${sprite.visible}, Alpha=${sprite.alpha}`
        );
      }

      if (sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
        sprite.setVisible(initialVisible);
      }

      // Process animations if they exist
      if (normalizedElement.timeline) {
        const adjustedTimeline = this.adjustTimeline(
          normalizedElement.timeline,
          widthRatio,
          heightRatio,
          normalizedElement.assetName,
          normalizedElement
        );
        const sequence = this.convertTimelineToAnimations({
          ...normalizedElement,
          timeline: adjustedTimeline,
        });
        if (sequence.length > 0 && sprite) {
          // Log animations to debug visibility issues
          sequence.forEach((anim, index) => {
            if (anim.type === "visibility") {
              console.log(
                `Element ${normalizedElement.elementName}: Visibility animation ${index} - Delay=${anim.config.delay}ms, StartValue=${anim.config.startValue}`
              );
            }
          });
          syncGroups.push({ target: sprite, sequence });
        }
      }
    }

    // Hide inactive elements
    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Text
        ) {
          sprite.setVisible(false);
          console.log(`Hiding inactive element: ${elementName}`);
        }
      }
    }

    // Play all animations synchronously
    if (syncGroups.length > 0) {
      await this.syncSystem.playSync(syncGroups);
    }
  }

  /**
   * Handle resolution changes by clearing and reinitializing assets
   */
  public async handleResolutionChange(): Promise<void> {
    console.log("VideoService: Handling resolution change - clearing assets");

    const gameObjects = [...this.activeSprites.values()].filter(
      (sprite) =>
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
    ) as Phaser.GameObjects.GameObject[];

    if (gameObjects.length > 0) {
      this.syncSystem.stopAll(gameObjects);
    }

    this.activeSprites.forEach((sprite) => {
      if (sprite instanceof Phaser.Sound.WebAudioSound) {
        sprite.stop();
        sprite.destroy();
      } else {
        sprite.destroy();
      }
    });
    this.activeSprites.clear();

    this.timelineData = null;
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    this.currentWidth = this.scene.scale.width;
    this.currentHeight = this.scene.scale.height;

    console.log(
      `VideoService: Assets cleared, ready for new timeline at resolution ${this.currentWidth}x${this.currentHeight}`
    );
  }

  /**
   * Adjust timeline animations based on screen resolution
   */
  private adjustTimeline(
    timeline: any,
    widthRatio: number,
    heightRatio: number,
    assetName: string,
    element: TimelineElement
  ): any {
    const adjustedTimeline = { ...timeline };
    const assetInfo = this.assetService.getAssetInfo(assetName);

    // Adjust position animations
    if (adjustedTimeline.position) {
      const initialX = element.initialState?.position?.x ?? 0;
      const initialY = element.initialState?.position?.y ?? 0;
      const initialZ = element.initialState?.position?.z ?? 0;

      // Check if position uses anchor and is relative
      const hasAnchor = !!element.initialState?.anchor;
      const isSmallValue = initialX <= 1 && initialY <= 1;

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

          let startX =
            pos.startValue.x !== undefined ? pos.startValue.x : previousX;
          let startY =
            pos.startValue.y !== undefined ? pos.startValue.y : previousY;
          let endX = pos.endValue.x !== undefined ? pos.endValue.x : startX;
          let endY = pos.endValue.y !== undefined ? pos.endValue.y : startY;

          // If using anchor and values are relative, adjust based on anchor
          if (hasAnchor && isSmallValue) {
            const anchorX = element.initialState?.anchor?.x ?? 0.5;
            const anchorY = element.initialState?.anchor?.y ?? 0.5;

            const baseX = anchorX * this.currentWidth;
            const baseY = anchorY * this.currentHeight;

            return {
              ...pos,
              startValue: {
                x: baseX + startX * widthRatio,
                y: baseY + startY * heightRatio,
                z:
                  pos.startValue.z !== undefined ? pos.startValue.z : previousZ,
              },
              endValue: {
                x: baseX + endX * widthRatio,
                y: baseY + endY * heightRatio,
                z:
                  pos.endValue.z !== undefined
                    ? pos.endValue.z
                    : pos.startValue.z !== undefined
                    ? pos.startValue.z
                    : previousZ,
              },
            };
          } else {
            // Otherwise just scale by resolution ratio
            return {
              ...pos,
              startValue: {
                x: startX * widthRatio,
                y: startY * heightRatio,
                z:
                  pos.startValue.z !== undefined ? pos.startValue.z : previousZ,
              },
              endValue: {
                x: endX * widthRatio,
                y: endY * heightRatio,
                z:
                  pos.endValue.z !== undefined
                    ? pos.endValue.z
                    : pos.startValue.z !== undefined
                    ? pos.startValue.z
                    : previousZ,
              },
            };
          }
        }
      );
    }

    // Adjust scale animations
    if (adjustedTimeline.scale) {
      if (assetInfo?.scale_override) {
        // Skip timeline scale if asset has scale override
        delete adjustedTimeline.scale;
      } else {
        // Adjust scale animations according to screen ratio
        adjustedTimeline.scale = adjustedTimeline.scale.map((scale: any) => {
          const uniformScaleStart = this.calculateUniformScale(
            assetName,
            scale.startValue.x,
            scale.startValue.y,
            widthRatio,
            heightRatio,
            element
          );
          const uniformScaleEnd = this.calculateUniformScale(
            assetName,
            scale.endValue.x,
            scale.endValue.y,
            widthRatio,
            heightRatio,
            element
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

  /**
   * Pause all active animations
   */
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

  /**
   * Resume all paused animations
   */
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
