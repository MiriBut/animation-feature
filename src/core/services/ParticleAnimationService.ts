import { Scene, GameObjects } from "phaser";
import { TimelineElement } from "../../types/interfaces/TimelineInterfaces";
import { AssetElement } from "../../types/interfaces/AssetInterfaces";

export class ParticleAnimationService {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public applyParticleAnimations(
    emitter: GameObjects.Particles.ParticleEmitter,
    container: Phaser.GameObjects.Container,
    timelineElement: TimelineElement
  ): void {
    const timeline = timelineElement.timeline;

    // Apply initial configuration
    this.configureEmitter(emitter);

    if (timeline?.scale)
      this.applyParticleScaleAnimation(emitter, timeline.scale[0]);
    if (timeline?.position)
      this.applyParticlePositionAnimation(
        container,
        emitter,
        timeline.position[0]
      );
    if (timeline?.opacity)
      this.applyParticleOpacityAnimation(emitter, timeline.opacity[0]);
    if (timeline?.color)
      this.applyParticleColorAnimation(emitter, timeline.color[0]);
  }

  private configureEmitter(
    emitter: GameObjects.Particles.ParticleEmitter
  ): void {
    const config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      speed: { min: 50, max: 100 },
      lifespan: { min: 1000, max: 2000 },
      quantity: 1,
      frequency: 100,
      blendMode: Phaser.BlendModes.ADD,
      emitZone: {
        type: "random" as const,
        source: new Phaser.Geom.Rectangle(-10, -10, 20, 20),
        quantity: 1,
      },
      gravityY: 200,
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0 },
    };

    emitter.setConfig(config);
    emitter.start();
  }

  private applyParticleScaleAnimation(
    emitter: GameObjects.Particles.ParticleEmitter,
    anim: any
  ): void {
    if (!anim) return;

    const startScale = { x: emitter.scaleX || 1, y: emitter.scaleY || 1 };
    const endScale = anim.endValue;

    const config: Partial<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> =
      {
        scale: {
          start: startScale.x,
          end: endScale.x,
        },
      };

    emitter.setConfig(config);

    this.scene.tweens.add({
      targets: emitter,
      scaleX: endScale.x,
      scaleY: endScale.y,
      duration: (anim.endTime - anim.startTime) * 1000,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
    });
  }

  private applyParticlePositionAnimation(
    container: Phaser.GameObjects.Container,
    emitter: GameObjects.Particles.ParticleEmitter,
    anim: any
  ): void {
    if (!anim) {
      console.log("No animation provided, returning early");
      return;
    }

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    // חישוב נקודות התחלה וסוף
    const startPos = {
      x: container.x,
      y: container.y,
      z: container.depth,
    };

    const endPos = {
      x:
        anim.endValue.x !== undefined
          ? (anim.endValue.x / 1920) * screenWidth
          : startPos.x,
      y:
        anim.endValue.y !== undefined
          ? (anim.endValue.y / 1080) * screenHeight
          : startPos.y,
      z:
        anim.endValue.z !== undefined
          ? Math.round(anim.endValue.z)
          : startPos.z,
    };

    const duration = (anim.endTime - anim.startTime) * 1000;

    // נשמור את הקונפיג המקורי
    const originalConfig = {
      frequency: emitter.frequency,
      lifespan: emitter.lifespan,
      quantity: emitter.quantity,
      speed: emitter.speed,
      scale: emitter.scaleX, // assuming uniform scale
      alpha: emitter.alpha,
      // rotate: emitter.rotate,
      // tint: emitter.tint,
      blendMode: emitter.blendMode,
      gravityX: emitter.gravityX,
      gravityY: emitter.gravityY,
    };

    console.log("Current emitter config:", originalConfig);

    // נגדיר קונפיג חדש שישמור על תנועת הפרטיקלס יחסית למערכת
    const config: Partial<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> =
      {
        ...originalConfig,
        // מבטל תנועה מוחלטת
        speed: 0,
        gravityX: 0,
        gravityY: 0,
        frequency: 100, // נוודא שיש מספיק פרטיקלס
        quantity: 2,
        lifespan: 1000, // חיים לשנייה
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 1, end: 0 },
      };

    console.log("New emitter config:", config);

    // מעדכן את הקונפיג
    emitter.setConfig(config);

    // מזיז את הקונטיינר (שמכיל את ה-emitter)
    const tween = this.scene.tweens.add({
      targets: container,
      x: endPos.x,
      y: endPos.y,
      depth: endPos.z,
      duration: duration,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
      onComplete: () => {
        // מחזיר את הקונפיג המקורי
        emitter.setConfig(originalConfig);
      },
    });
  }

  private applyParticleOpacityAnimation(
    emitter: GameObjects.Particles.ParticleEmitter,
    anim: any
  ): void {
    if (!anim) return;

    const startAlpha = emitter.alpha || 1;
    const endAlpha = anim.endValue;

    const config: Partial<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> =
      {
        alpha: {
          start: startAlpha,
          end: endAlpha,
        },
      };

    emitter.setConfig(config);

    this.scene.tweens.add({
      targets: emitter,
      alpha: endAlpha,
      duration: (anim.endTime - anim.startTime) * 1000,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
    });
  }

  private applyParticleColorAnimation(
    emitter: GameObjects.Particles.ParticleEmitter,
    anim: any
  ): void {
    if (!anim) return;

    const startColor = parseInt(anim.startValue.replace("0x", ""), 16);
    const endColor = parseInt(anim.endValue.replace("0x", ""), 16);

    const config: Partial<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> =
      {
        tint: startColor,
      };

    emitter.setConfig(config);

    this.scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      duration: (anim.endTime - anim.startTime) * 1000,
      delay: anim.startTime * 1000,
      ease: anim.easeIn || "Linear",
      onUpdate: (tween) => {
        const progress = tween.getValue();
        const currentColor = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(startColor),
          Phaser.Display.Color.ValueToColor(endColor),
          100,
          progress * 100
        );

        emitter.setConfig({
          tint: Phaser.Display.Color.GetColor(
            currentColor.r,
            currentColor.g,
            currentColor.b
          ),
        });
      },
    });
  }
}
