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
import { SpineState } from "@/types/interfaces/AssetInterfaces";

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
  private currentWidth: number; // משתנה חדש לרזולוציה הנוכחית
  private currentHeight: number; // משתנה חדש לרזולוציה הנוכחית

  constructor(private scene: Scene, private assetService: AssetService) {
    this.syncSystem = new SyncSystem(scene);
    this.currentWidth = scene.scale.width; // אתחול ראשוני
    this.currentHeight = scene.scale.height; // אתחול ראשוני
    this.setupScene();
  }

  public handleResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void {
    console.log(`handleResize in video service`);
    this.handleResolutionChange();
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

      // עדכון הרזולוציה הנוכחית לפני הטעינה
      this.currentWidth = this.scene.scale.width;
      this.currentHeight = this.scene.scale.height;
      console.log(
        `VideoService: Loading timeline with resolution ${this.currentWidth}x${this.currentHeight}`
      );

      await this.loadTimelineAssets();

      this.countdownTimer = new CountdownTimer(this.scene);
      await this.countdownTimer.start();

      await this.initializeTimelineElements(); // נעביר את ההתאמות לפונקציה הזו
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
      // כאן אפשר גם להציג התראה למשתמש על אסטים שנכשלו
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
    let aspectRatio = 1; // ברירת מחדל: יחס 1:1

    // בדיקה אם יש aspect_ratio_override
    if (assetInfo && assetInfo.pivot_override?.aspect_ratio_override) {
      const { width, height } = assetInfo.pivot_override.aspect_ratio_override;
      aspectRatio = width / height;
      console.log(
        `Aspect ratio from override for ${assetName}: ${aspectRatio} (${width}/${height})`
      );
    } else {
      // חזרה ליחס ממדים של האסט עצמו כברירת מחדל
      const sprite = this.assetService.displayAsset(
        assetName,
        { x: 0, y: 0, scale: 1 },
        assetName
      );
      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Image
      ) {
        aspectRatio = sprite.width / sprite.height;
        console.log(
          `Aspect ratio from sprite for ${assetName}: ${aspectRatio} (${sprite.width}/${sprite.height})`
        );
        sprite.destroy();
      } else if (sprite instanceof Phaser.GameObjects.Video) {
        aspectRatio = sprite.width / sprite.height;
        console.log(
          `Aspect ratio from video for ${assetName}: ${aspectRatio} (${sprite.width}/${sprite.height})`
        );
        sprite.destroy();
      } else {
        console.warn(`No aspect ratio info for ${assetName}, using 1:1`);
      }
    }

    // חישוב סקייל אחיד תוך שמירה על aspect ratio
    const adjustedScaleX = baseScaleX * widthRatio;
    const adjustedScaleY = baseScaleY * heightRatio;
    let uniformScale: number;

    if (adjustedScaleX * aspectRatio > adjustedScaleY) {
      uniformScale = adjustedScaleY / aspectRatio; // מתאים לפי גובה
    } else {
      uniformScale = adjustedScaleX; // מתאים לפי רוחב
    }

    return { x: uniformScale, y: uniformScale * aspectRatio };
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

    // שימוש ברזולוציה הנוכחית שנשמרה
    const screenWidth = this.currentWidth;
    const screenHeight = this.currentHeight;

    // לוג לבדיקת הערכים
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
        const audioKey = timelineElement.assetName || "bg_music";
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
              startValue: undefined,
              endValue: undefined,
              easing: "Linear",
              duration: (playConfig.endTime - playConfig.startTime) * 1000,
              delay: playConfig.startTime * 1000,
              audioKey: timelineElement.assetName || "bg_music",
              loop: playConfig.loop === "true",
              stopOnComplete: playConfig.loop !== "true",
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
              audioKey: timelineElement.assetName || "bg_music",
              volume: {
                startValue: volumeConfig.startValue,
                endValue: volumeConfig.endValue,
              },
              stopOnComplete: false,
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
            loop: anim.loop,
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

    // Handle position - השתמש בערכים המותאמים ישירות
    if (timeline?.position) {
      sequence.push({
        type: "position",
        config: {
          property: "position",
          startValue: timeline.position[0].startValue, // כבר מותאם מ-adjustTimeline
          endValue: timeline.position[0].endValue, // כבר מותאם מ-adjustTimeline
          duration:
            (timeline.position[0].endTime - timeline.position[0].startTime) *
            1000,
          easing: timeline.position[0].easeIn || "Linear",
          delay: timeline.position[0].startTime * 1000,
        },
      });
      console.log(
        `Position for ${timelineElement.elementName}: Start (${timeline.position[0].startValue.x}, ${timeline.position[0].startValue.y}), End (${timeline.position[0].endValue.x}, ${timeline.position[0].endValue.y})`
      );
    }

    // Handle opacity
    if (timeline?.opacity) {
      sequence.push({
        type: "opacity",
        config: {
          property: "opacity",
          startValue: timeline.opacity[0].startValue,
          endValue: timeline.opacity[0].endValue,
          duration:
            (timeline.opacity[0].endTime - timeline.opacity[0].startTime) *
            1000,
          easing: timeline.opacity[0].easeIn || "Linear",
          delay: timeline.opacity[0].startTime * 1000,
        },
      });
    }

    // Handle scale - השתמש בערכים המותאמים ישירות
    if (timeline?.scale) {
      const isSupported =
        targetSprite instanceof Phaser.GameObjects.Sprite ||
        targetSprite instanceof Phaser.GameObjects.Video ||
        targetSprite instanceof SpineGameObject ||
        targetSprite instanceof Phaser.GameObjects.Text;

      if (isSupported) {
        sequence.push({
          type: "scale",
          config: {
            property: "scale",
            startValue: timeline.scale[0].startValue, // כבר מותאם מ-adjustTimeline
            endValue: timeline.scale[0].endValue, // כבר מותאם מ-adjustTimeline
            duration:
              (timeline.scale[0].endTime - timeline.scale[0].startTime) * 1000,
            easing: timeline.scale[0].easeIn || "Linear",
            delay: timeline.scale[0].startTime * 1000,
          },
        });
        console.log(
          `Scale for ${timelineElement.elementName}: Start (${timeline.scale[0].startValue.x}, ${timeline.scale[0].startValue.y}), End (${timeline.scale[0].endValue.x}, ${timeline.scale[0].endValue.y})`
        );
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

    // סינון ה-GameObjects שיכולים להישלח ל-stopAll
    const gameObjects = [...this.activeSprites.values()].filter(
      (sprite) =>
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
    ) as Phaser.GameObjects.GameObject[];

    // עצירת כל האנימציות עבור GameObjects
    if (gameObjects.length > 0) {
      this.syncSystem.stopAll(gameObjects);
    }

    // הרס כל האסטים (ספרייטים, סאונד וכו')
    this.activeSprites.forEach((sprite) => {
      if (sprite instanceof Phaser.Sound.WebAudioSound) {
        sprite.stop();
        sprite.destroy();
      } else {
        sprite.destroy();
      }
    });
    this.activeSprites.clear();

    // ניקוי הטיימליין והטיימר בלבד, בלי לאפס את ה-syncSystem או הסצנה
    this.timelineData = null;
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    // עדכון הרזולוציה הנוכחית
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
      const isExistingSprite = !!sprite;

      const widthRatio = this.currentWidth / baseWidth;
      const heightRatio = this.currentHeight / baseHeight;

      const uniformScale = this.calculateUniformScale(
        element.assetName,
        element.initialState.scale?.x ?? 1,
        element.initialState.scale?.y ?? 1,
        widthRatio,
        heightRatio
      );

      const adjustedInitialState = {
        ...element.initialState,
        position: element.initialState.position
          ? {
              x: (element.initialState.position.x ?? 0) * widthRatio,
              y: (element.initialState.position.y ?? 0) * heightRatio,
              z: element.initialState.position.z ?? 0,
            }
          : undefined,
        scale: uniformScale,
      };

      if (element.assetType === "audio") {
        if (!sprite || !(sprite instanceof Phaser.Sound.WebAudioSound)) {
          const audioKey = element.assetName || "bg_music";
          let sound = this.scene.sound.get(audioKey);
          if (!sound) {
            sound = this.scene.sound.add(audioKey, {
              volume: adjustedInitialState.volume || 0.5,
              loop: adjustedInitialState.loop === true,
            });
          }
          sprite = sound as Phaser.Sound.WebAudioSound;
          this.activeSprites.set(element.elementName, sprite);
        }
      } else if (element.assetType === "text") {
        if (!sprite || !(sprite instanceof Phaser.GameObjects.Text)) {
          console.log(
            `VideoService: Creating text object for ${element.elementName}`
          );

          // חישוב fontSize מותאם שמוגבל לגודל המסך
          let fontSize: number;
          if (typeof adjustedInitialState.fontSize === "string") {
            fontSize = parseInt(adjustedInitialState.fontSize, 10); // אם יש ערך מוגדר בטיימליין
          } else {
            // גודל בסיס של 32px, מותאם לפי היחס הקטן יותר, עם מקסימום
            const textScaleFactor = Math.min(widthRatio, heightRatio);
            fontSize = Math.min(32 * textScaleFactor, this.currentHeight * 0.1); // מקסימום 10% מגובה המסך
          }

          const textObj = this.scene.add.text(
            adjustedInitialState.position?.x ?? this.currentWidth / 2,
            adjustedInitialState.position?.y ?? this.currentHeight / 2,
            typeof adjustedInitialState.text === "string"
              ? adjustedInitialState.text
              : "",
            {
              fontSize: `${fontSize}px`,
              fontFamily: "Arial",
              color:
                typeof adjustedInitialState.color === "string"
                  ? adjustedInitialState.color
                  : "#ffffff",
              fontStyle: "normal",
              align: "center",
            }
          );

          // התאמת מיקום כדי שהטקסט לא יגלוש מהמסך
          const textWidth = textObj.displayWidth;
          const textHeight = textObj.displayHeight;
          let x = adjustedInitialState.position?.x ?? this.currentWidth / 2;
          let y = adjustedInitialState.position?.y ?? this.currentHeight / 2;

          // וידוא שהטקסט נשאר בתוך גבולות המסך
          if (x - textWidth / 2 < 0) x = textWidth / 2;
          if (x + textWidth / 2 > this.currentWidth)
            x = this.currentWidth - textWidth / 2;
          if (y - textHeight / 2 < 0) y = textHeight / 2;
          if (y + textHeight / 2 > this.currentHeight)
            y = this.currentHeight - textHeight / 2;

          textObj.setPosition(x, y);
          textObj.setDepth(adjustedInitialState.position?.z ?? 0);
          textObj.setAlpha(adjustedInitialState.opacity ?? 1);
          // לא משתמשים ב-setScale כדי למנוע עיוות כפול

          if (typeof adjustedInitialState.rotation === "number") {
            textObj.setRotation(adjustedInitialState.rotation);
          }

          sprite = textObj;
          this.activeSprites.set(element.elementName, sprite);

          // לוגים מפורטים לבדיקת הגודל והמיקום
          console.log(
            `Text ${element.elementName}: fontSize=${fontSize}px, ` +
              `displayWidth=${textWidth}, displayHeight=${textHeight}, ` +
              `position=(${x}, ${y}), ` +
              `screen=(${this.currentWidth}x${this.currentHeight})`
          );
        }
      } else if (!sprite) {
        const spriteOrContainer = this.assetService.displayAsset(
          element.assetName,
          {
            x: adjustedInitialState.position?.x ?? 0,
            y: adjustedInitialState.position?.y ?? 0,
            scale: uniformScale.x,
            alpha: adjustedInitialState.opacity ?? 1,
            rotation: adjustedInitialState.rotation ?? 0,
            tint: adjustedInitialState.color
              ? parseInt(adjustedInitialState.color)
              : undefined,
          },
          element.elementName
        );

        sprite = spriteOrContainer;
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Image ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
        ) {
          sprite.setVisible(true);
        }
        this.activeSprites.set(element.elementName, sprite);
      }

      if (element.timeline) {
        const adjustedTimeline = this.adjustTimeline(
          element.timeline,
          widthRatio,
          heightRatio,
          element.assetName
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

      if (
        sprite instanceof Phaser.GameObjects.Sprite ||
        sprite instanceof Phaser.GameObjects.Image ||
        sprite instanceof Phaser.GameObjects.Video ||
        sprite instanceof Phaser.GameObjects.Container ||
        sprite instanceof SpineGameObject ||
        sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
      ) {
        sprite.setDepth(adjustedInitialState.position?.z ?? 0);
      }
    }

    for (const [elementName, sprite] of this.activeSprites.entries()) {
      if (!activeElements.has(elementName)) {
        if (
          sprite instanceof Phaser.GameObjects.Sprite ||
          sprite instanceof Phaser.GameObjects.Image ||
          sprite instanceof Phaser.GameObjects.Video ||
          sprite instanceof SpineGameObject ||
          sprite instanceof Phaser.GameObjects.Particles.ParticleEmitter
        ) {
          sprite.setVisible(false);
        }
      }
    }

    if (syncGroups.length > 0) {
      await this.syncSystem.playSync(syncGroups);
    }
  }

  // פונקציה חדשה להתאמת הטיימליין לרזולוציה
  private adjustTimeline(
    timeline: any,
    widthRatio: number,
    heightRatio: number,
    assetName: string
  ): any {
    const adjustedTimeline = { ...timeline };

    if (adjustedTimeline.position) {
      adjustedTimeline.position = adjustedTimeline.position.map((pos: any) => ({
        ...pos,
        startValue: {
          x: pos.startValue.x * widthRatio,
          y: pos.startValue.y * heightRatio,
        },
        endValue: {
          x: pos.endValue.x * widthRatio,
          y: pos.endValue.y * heightRatio,
        },
      }));
    }

    if (adjustedTimeline.scale) {
      adjustedTimeline.scale = adjustedTimeline.scale.map((scale: any) => {
        const uniformScale = this.calculateUniformScale(
          assetName,
          scale.startValue.x,
          scale.startValue.y,
          widthRatio,
          heightRatio
        );
        return {
          ...scale,
          startValue: uniformScale,
          endValue: this.calculateUniformScale(
            assetName,
            scale.endValue.x,
            scale.endValue.y,
            widthRatio,
            heightRatio
          ),
        };
      });
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
        this.syncSystem.pauseAll([sprite]); // או resumeAll/stopAll
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

    // עצור את כל האנימציות הפעילות
    this.stopAllAnimations();

    // עצור וידאו
    this.stopAllVideos();

    // הרס כל הספרייטים הפעילים
    this.activeSprites.forEach((sprite, elementName) => {
      try {
        console.log(`VideoService: Destroying sprite ${elementName}`);

        if (sprite instanceof Phaser.Sound.WebAudioSound) {
          sprite.stop();
          sprite.destroy();
        } else if (sprite instanceof Phaser.GameObjects.Container) {
          // נקה את כל האובייקטים בקונטיינר קודם
          sprite.removeAll(true);
          sprite.destroy();
        } else {
          // ניסיון להסיר את האובייקט מהסצנה
          if (sprite.destroy) {
            sprite.destroy();
          } else {
            // גיבוי למקרה שאין מתודת destroy
            this.scene.children.remove(sprite);
          }
        }
      } catch (e) {
        console.warn(`Error destroying sprite ${elementName}:`, e);
      }
    });

    // נקה את מפת הספרייטים הפעילים
    this.activeSprites.clear();

    // איפוס נתוני הטיימליין
    this.timelineData = null;

    // ניקוי הטיימר אם קיים
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    console.log("VideoService: All assets cleared successfully");
  }

  // Helper methods that might be needed
  private stopAllVideos(): void {
    console.log("VideoService: Stopping all active videos");

    // מעבר על כל האסטים במפה ועצירת וידאו
    this.activeSprites.forEach((sprite, elementName) => {
      // עצירת וידאו אם זהו אובייקט וידאו
      if (sprite instanceof Phaser.GameObjects.Video) {
        sprite.stop();
        console.log(`Stopped video: ${elementName}`);
      }

      // אם זה מכיל וידאו בתוך קונטיינר
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

    // אם יש נתוני טיימליין, נאפס אותם
    this.timelineData = null;

    // בשלב זה, נוותר על מחיקת טקסטורות כדי למנוע שגיאות
    // נשמור את הקוד הקודם כפי שהוא, אבל נסמן אותו כבהערה כרגע

    /*
    // ניקוי קאש טקסטורות עבור וידאו - הקוד שהיה קודם
    const textures = this.scene.textures;
    const protectedTextures = ['__DEFAULT', '__MISSING'];
    
    // איסוף שמות של טקסטורות שקשורות לוידאו כדי למחוק אותן
    const videoTextureKeys: string[] = [];
    this.activeSprites.forEach((sprite, elementName) => {
      if (sprite instanceof Phaser.GameObjects.Video || 
          sprite instanceof Phaser.GameObjects.Sprite) {
        // שמור את מפתח הטקסטורה אם הוא קיים
        const textureKey = sprite.texture?.key;
        if (textureKey && !protectedTextures.includes(textureKey)) {
          videoTextureKeys.push(textureKey);
        }
      }
    });
    
    // מחיקת הטקסטורות ששמרנו
    videoTextureKeys.forEach(key => {
      if (textures.exists(key)) {
        textures.remove(key);
        console.log(`Removed texture from cache: ${key}`);
      }
    });
    */

    // במקום זאת, רק נרשום לוג שאנחנו מדלגים על ניקוי הטקסטורות כדי להימנע משגיאות
    console.log(
      "VideoService: Skipping texture cache clearing to avoid errors"
    );
  }

  private resetState(): void {
    console.log("VideoService: Resetting internal state");

    // איפוס משתנים פנימיים
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }

    // ניקוי המפה של הספרייטים הפעילים
    this.activeSprites.clear();
  }
}
