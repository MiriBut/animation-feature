import { Scene } from "phaser";
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
      // Get anchor information if available
      const hasAnchor = !!timelineElement.initialState?.anchor;
      const anchorX = timelineElement.initialState?.anchor?.x ?? 0.5;
      const anchorY = timelineElement.initialState?.anchor?.y ?? 0.5;

      timeline.position.forEach((positionAnim) => {
        const startZ =
          positionAnim.startValue.z ??
          timelineElement.initialState?.position?.z ??
          0;
        const endZ = positionAnim.endValue.z ?? startZ;

        // Get animation start and end positions
        const animStartX = positionAnim.startValue.x;
        const animStartY = positionAnim.startValue.y;
        const animEndX = positionAnim.endValue.x;
        const animEndY = positionAnim.endValue.y;

        // Check if values are relative (typically small values <= 1) and if anchor is present
        const isSmallValue =
          animStartX <= 1 && animStartY <= 1 && animEndX <= 1 && animEndY <= 1;
        const needConversion = hasAnchor && isSmallValue;

        // Final position values after calculation
        let finalStartX = animStartX;
        let finalStartY = animStartY;
        let finalEndX = animEndX;
        let finalEndY = animEndY;

        if (needConversion) {
          // Calculate base position from anchor (relative to screen)
          const baseX = anchorX * this.currentWidth;
          const baseY = anchorY * this.currentHeight;

          // Convert relative positions to pixels, scaling by screen ratio
          finalStartX = baseX + animStartX * widthRatio;
          finalStartY = baseY + animStartY * heightRatio;
          finalEndX = baseX + animEndX * widthRatio;
          finalEndY = baseY + animEndY * heightRatio;

          console.log(
            `Timeline position for "${timelineElement.elementName}": ` +
              `Converted from (${animStartX}, ${animStartY}) -> (${animEndX}, ${animEndY}) ` +
              `to pixels (${finalStartX}, ${finalStartY}) -> (${finalEndX}, ${finalEndY}) ` +
              `using anchor (${anchorX}, ${anchorY})`
          );
        } else {
          // For non-relative values, just scale them according to screen ratio
          finalStartX = animStartX * widthRatio;
          finalStartY = animStartY * heightRatio;
          finalEndX = animEndX * widthRatio;
          finalEndY = animEndY * heightRatio;

          console.log(
            `Timeline position for "${timelineElement.elementName}": ` +
              `Using values as-is: (${finalStartX}, ${finalStartY}) -> (${finalEndX}, ${finalEndY})`
          );
        }

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

    return sequence;
  }

  /**
   * Initialize all elements from the timeline data
   */
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

    for (const normalizedElement of normalizedElements) {
      if (!normalizedElement.initialState) continue;

      // Get initial position and anchor values
      const positionX = normalizedElement.initialState?.position?.x ?? 0;
      const positionY = normalizedElement.initialState?.position?.y ?? 0;
      const hasAnchor = !!normalizedElement.initialState?.anchor;
      const anchorX = normalizedElement.initialState?.anchor?.x ?? 0.5;
      const anchorY = normalizedElement.initialState?.anchor?.y ?? 0.5;

      console.log(
        `Element ${normalizedElement.elementName}: Raw position from normalizedElement:`,
        normalizedElement.initialState?.position
      );

      // Calculate final position
      let finalX: number;
      let finalY: number;

      if (hasAnchor) {
        // If there's an anchor, position relative to it, ignoring absolute values
        finalX = anchorX * this.currentWidth; // Center based on anchor
        finalY = anchorY * this.currentHeight; // Center based on anchor

        // Add position as a relative offset if it's small
        const isRelativePosition =
          Math.abs(positionX) <= 1 && Math.abs(positionY) <= 1;
        if (isRelativePosition) {
          finalX += positionX * this.currentWidth;
          finalY += positionY * this.currentHeight;
        }

        console.log(
          `Element ${normalizedElement.elementName}: ` +
            `Position with anchor: (${finalX}, ${finalY}) ` +
            `from anchor (${anchorX}, ${anchorY}) ` +
            (isRelativePosition
              ? `with relative offset (${positionX}, ${positionY}) scaled by (${this.currentWidth}, ${this.currentHeight})`
              : `ignoring absolute position (${positionX}, ${positionY})`)
        );
      } else {
        // No anchor: scale absolute position directly
        finalX = positionX * widthRatio;
        finalY = positionY * heightRatio;

        console.log(
          `Element ${normalizedElement.elementName}: ` +
            `Absolute position scaled: (${finalX}, ${finalY}) ` +
            `from (${positionX}, ${positionY}) with ratio (${widthRatio}, ${heightRatio})`
        );
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
        alpha: normalizedElement.initialState?.opacity ?? 1,
        rotation: normalizedElement.initialState?.rotation ?? 0,
        tint: normalizedElement.initialState?.color
          ? parseInt(normalizedElement.initialState.color.replace("#", ""), 16)
          : undefined,
        ratio: assetInfo?.aspect_ratio_override,
        assetName: normalizedElement.assetName,
        pivot: pivot,
        timelineScale: undefined,
      };

      // Display the element using asset service
      sprite = this.assetService.displayElement(
        normalizedElement.assetName,
        initialState,
        normalizedElement.elementName
      );
      this.activeSprites.set(normalizedElement.elementName, sprite);

      // Set sprite properties based on type
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof Phaser.GameObjects.Text
      ) {
        const spriteWidth = sprite.width * scaleX;
        const spriteHeight = sprite.height * scaleY;
        sprite.setPosition(
          finalX - spriteWidth * (pivot.x - 0.5), // Adjust for pivot offset
          finalY - spriteHeight * (pivot.y - 0.5) // Adjust for pivot offset
        );
        sprite.setOrigin(pivot.x, pivot.y);
        sprite.setScale(scaleX, scaleY);
        sprite.setDepth(normalizedElement.initialState?.position?.z ?? 0);
        sprite.setVisible(true);
      } else if (sprite instanceof SpineGameObject) {
        const spriteWidth = (sprite.skeleton?.data?.width || 100) * scaleX;
        const spriteHeight = (sprite.skeleton?.data?.height || 100) * scaleY;
        sprite.setPosition(
          finalX - spriteWidth * (pivot.x - 0.5), // Adjust for pivot offset
          finalY - spriteHeight * (pivot.y - 0.5) // Adjust for pivot offset
        );
        sprite.setOrigin(pivot.x, pivot.y);
        sprite.setScale(scaleX, scaleY);
        sprite.setDepth(normalizedElement.initialState?.position?.z ?? 0);
        sprite.setVisible(true);
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
