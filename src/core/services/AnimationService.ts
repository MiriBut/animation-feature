import { TimelineElement } from "../../types/interfaces/TimelineInterfaces";
import { AssetElement } from "../../types/interfaces/AssetInterfaces";
import { Scene, GameObjects, Geom } from "phaser";

export class AnimationService {
  private scene: Scene;
  private particles: Map<string, GameObjects.Particles.ParticleEmitter>;

  constructor(scene: Scene) {
    this.scene = scene;
    this.particles = new Map();
  }

  public applyAnimations(
    gameObject:
      | GameObjects.Sprite
      | GameObjects.Image
      | GameObjects.Particles.ParticleEmitter
      | null,
    timelineElement: TimelineElement,
    assetElement?: AssetElement
  ): void {
    if (!timelineElement) return;

    if (timelineElement.assetType === "particle") {
      const textureName = timelineElement.particles?.textureName;

      if (!textureName) {
        console.log(
          `[setupParticles] Missing textureName in particles for ${timelineElement.elementName}`
        );
      }
      this.scene.load.image("particleTexture", assetElement?.assetUrl);

      const emitterManager = this.setupParticles(timelineElement);
      gameObject = emitterManager; // עכשיו נוכל להשתמש באותה לוגיקת אנימציה
      console.log(gameObject + " is the particle?");
    }

    if (!gameObject) return;

    const timeline = timelineElement.timeline;
    // בדיקת מצב התחלתי לכל האלמנטים
    console.log(`${timelineElement.elementName} - Initial State:`, {
      position: { x: gameObject.x, y: gameObject.y },
      scale: { x: gameObject.scaleX, y: gameObject.scaleY },
      alpha: gameObject.alpha,
      rotation: gameObject.angle,
      pivot: assetElement?.pivot_override || { x: 0.5, y: 0.5 },
    });

    const originalX = gameObject.x;
    const originalY = gameObject.y;
    const originalDepth = gameObject.depth;

    const pivotX = assetElement?.pivot_override?.x || 0.5;
    const pivotY = assetElement?.pivot_override?.y || 0.5;

    // בדיקת יצירת הקונטיינר
    const pivotContainer = this.scene.add.container(originalX, originalY);
    pivotContainer.setDepth(originalDepth);

    gameObject.setPosition(-pivotX, -pivotY);
    pivotContainer.add(gameObject);

    console.log(`${timelineElement.elementName} - After Container Setup:`, {
      containerPosition: { x: pivotContainer.x, y: pivotContainer.y },
      objectPositionInContainer: { x: gameObject.x, y: gameObject.y },
      pivot: { x: pivotX, y: pivotY },
    });

    // Scale Animation
    if (timeline?.scale) {
      const anim = timeline.scale[0];
      if (anim) {
        console.log(`${timelineElement.elementName} - Scale Animation:`, {
          from: { x: pivotContainer.scaleX, y: pivotContainer.scaleY },
          to: anim.endValue,
          duration: anim.endTime - anim.startTime,
        });

        this.scene.tweens.add({
          targets: pivotContainer,
          scaleX: anim.endValue.x,
          scaleY: anim.endValue.y,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
          onComplete: () => {
            console.log(`${timelineElement.elementName} - Scale Complete:`, {
              finalScale: {
                x: pivotContainer.scaleX,
                y: pivotContainer.scaleY,
              },
            });
          },
        });
      }
    }

    // Position Animation
    if (timeline?.position) {
      const anim = timeline.position[0];
      if (anim) {
        const screenWidth = this.scene.scale.width;
        const screenHeight = this.scene.scale.height;

        const tweenConfig: any = {
          targets: pivotContainer,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
        };

        // רק אם יש ערכי x,y חדשים, נוסיף אותם לאנימציה
        if (anim.endValue.x !== undefined) {
          tweenConfig.x = (anim.endValue.x / 1920) * screenWidth;
        }
        if (anim.endValue.y !== undefined) {
          tweenConfig.y = (anim.endValue.y / 1080) * screenHeight;
        }

        // הוספת תמיכה באנימציית z
        if (anim.endValue.z !== undefined) {
          const startZ =
            anim.startValue?.z !== undefined
              ? Math.round(anim.startValue.z)
              : pivotContainer.depth;
          const endZ = Math.round(anim.endValue.z);

          // במקום לעשות אנימציה על אובייקט נפרד, נוסיף את ה-z ישירות ל-container
          tweenConfig.depth = {
            from: startZ,
            to: endZ,
          };
        }

        this.scene.tweens.add(tweenConfig);
      }
    }

    // Opacity Animation
    if (timeline?.opacity) {
      const anim = timeline.opacity[0];
      if (anim) {
        console.log(`${timelineElement.elementName} - Opacity Animation:`, {
          from: gameObject.alpha,
          to: anim.endValue,
          duration: anim.endTime - anim.startTime,
        });

        this.scene.tweens.add({
          targets: gameObject,
          alpha: anim.endValue,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
          onComplete: () => {
            console.log(`${timelineElement.elementName} - Opacity Complete:`, {
              finalAlpha: gameObject.alpha,
            });
          },
        });
      }
    }

    // Rotation Animation
    if (timeline?.rotation) {
      const anim = timeline.rotation[0];
      if (anim) {
        console.log(`${timelineElement.elementName} - Rotation Animation:`, {
          from: pivotContainer.angle,
          to: anim.endValue,
          duration: anim.endTime - anim.startTime,
        });

        this.scene.tweens.add({
          targets: pivotContainer,
          angle: anim.endValue,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
          onComplete: () => {
            console.log(`${timelineElement.elementName} - Rotation Complete:`, {
              finalAngle: pivotContainer.angle,
            });
          },
        });
      }
    }

    // Color Animation
    if (timeline?.color && "setTint" in gameObject) {
      const anim = timeline.color[0];
      if (anim) {
        const startColor = parseInt(anim.startValue.replace("0x", ""), 16);
        const endColor = parseInt(anim.endValue.replace("0x", ""), 16);

        (gameObject as GameObjects.Sprite | GameObjects.Image).setTint(
          startColor
        );

        this.scene.tweens.add({
          targets: {},
          tint: { from: 0, to: 1 },
          duration: (anim.endTime - anim.startTime) * 1000,
          delay: anim.startTime * 1000,
          ease: anim.easeIn || "Linear",
          onUpdate: (tween) => {
            const value = tween.getValue();
            const r1 = (startColor >> 16) & 0xff;
            const g1 = (startColor >> 8) & 0xff;
            const b1 = startColor & 0xff;

            const r2 = (endColor >> 16) & 0xff;
            const g2 = (endColor >> 8) & 0xff;
            const b2 = endColor & 0xff;

            const r = Math.floor(r1 + (r2 - r1) * value);
            const g = Math.floor(g1 + (g2 - g1) * value);
            const b = Math.floor(b1 + (b2 - b1) * value);

            const currentColor = (r << 16) | (g << 8) | b;
            if ("setTint" in gameObject) {
              (gameObject as GameObjects.Sprite | GameObjects.Image).setTint(
                currentColor
              );
            }
          },
        });
      }
    }

    if (timelineElement.onScreen) {
      console.log("onScreen found for:", timelineElement.elementName);
      gameObject.setAlpha(0);

      timelineElement.onScreen.forEach((screen) => {
        console.log("Processing screen time range:", screen);

        this.scene.tweens.add({
          targets: gameObject,
          alpha: 1,
          duration: 100,
          ease: "Linear",
          delay: screen.startTime * 1000,
        });

        this.scene.tweens.add({
          targets: gameObject,
          alpha: 0,
          duration: 100,
          ease: "Linear",
          delay: screen.endTime * 1000,
        });
      });
    } else {
      gameObject.setAlpha(1);
    }
  }

  private setupParticles(
    timelineElement: TimelineElement
  ): GameObjects.Particles.ParticleEmitter | null {
    if (!timelineElement.particles?.config) {
      throw new Error("Particle config is missing");
    }

    const config = timelineElement.particles.config;
    const emitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
      {
        frequency: config.frequency,
        lifespan: config.lifespan,
        quantity: config.quantity,
        speed: config.speed,
        scale: config.scale,
        alpha: config.alpha,
        rotate: config.rotate,
        tint: config.tint
          ? config.tint.map((color) => parseInt(color.toString(), 16))
          : undefined,
        blendMode: config.blendMode,
        gravityX: config.gravityX,
        gravityY: config.gravityY,
      };

    if (config.emitZone) {
      const line = new Geom.Line(0, 0, 100, 100);

      emitterConfig.emitZone = {
        type: "edge",
        source: line,
        quantity: 1,
        stepRate: 0,
        yoyo: false,
      };
    }

    try {
      // texture key must be a string, and createEmitter returns ParticleEmitter
      const textureName = timelineElement.particles?.textureName;
      if (!textureName) {
        console.error(
          `Missing textureName in particles for ${timelineElement.elementName}`
        );
        return null;
      }

      const emitter = this.scene.add.particles(0, 0, textureName);

      console.log(
        `[setupParticles] Created Emitter for ${timelineElement.elementName}:`,
        emitter
      );
      console.log(
        `[setupParticles] Emitter Position: x=${emitter.x}, y=${emitter.y}`
      );
      console.log(`[setupParticles] Emitter Active:`, emitter.active);
      // 🔹 בדיקת טקסטורה
      console.log(`[setupParticles] Checking textureName:`, textureName);

      if (!this.scene.textures.exists(textureName)) {
        console.error(
          `[setupParticles] ❌ Texture "${textureName}" is missing!`
        );
      }

      // 🔹 בדיקת מיקום ה־Emitter על המסך
      if (emitter.x === 0 && emitter.y === 0) {
        console.warn(
          `[setupParticles] ⚠️ Warning: Emitter is at (0,0) – it might be off-screen.`
        );
      }

      // 🔹 בדיקת Alpha
      console.log(`[setupParticles] Emitter Alpha:`, emitter.alpha);

      // 🔹 נסה להזיז את ה־Emitter למיקום ברור
      emitter.setPosition(400, 300);
      console.log(`[setupParticles] 🔄 Moved emitter to x=400, y=300`);

      // 🔹 הפעלת החלקיקים ידנית לבדיקה
      this.scene.time.delayedCall(1000, () => {
        console.log(`[Opacity Test] Setting emitter alpha to 1`);
        emitter.setAlpha(1);
      });

      this.particles.set(timelineElement.elementName, emitter);

      if (timelineElement.onScreen) {
        this.handleParticleVisibility(emitter, timelineElement.onScreen);
      }

      return emitter;
    } catch (error) {
      console.error("Error creating particle system:", error);
      return null;
    }
  }

  private handleParticleVisibility(
    emitter: GameObjects.Particles.ParticleEmitter,
    onScreen: { startTime: number; endTime: number }[]
  ): void {
    onScreen.forEach((screen) => {
      this.scene.time.delayedCall(screen.startTime * 1000, () => {
        emitter.start();
      });
      this.scene.time.delayedCall(screen.endTime * 1000, () => {
        emitter.stop();
      });
    });
  }

  public cleanupParticles(): void {
    this.particles.forEach((emitter) => {
      emitter.stop();
      // Since we can't directly access the parent, we'll remove the emitter
      // and it will be garbage collected
      emitter.destroy();
    });
    this.particles.clear();
  }
}
