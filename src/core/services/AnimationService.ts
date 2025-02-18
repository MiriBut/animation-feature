import { Scene, GameObjects } from "phaser";
import { TimelineElement } from "../../types/interfaces/TimelineInterfaces";
import { AssetElement } from "../../types/interfaces/AssetInterfaces";
import { ParticleService } from "./ParticleService";
import { ParticleAnimationService } from "./ParticleAnimationService";

export class AnimationService {
  private scene: Scene;
  private particleService: ParticleService;
  private particleAnimationService: ParticleAnimationService;
  add: any;

  constructor(scene: Scene) {
    this.scene = scene;
    this.particleService = new ParticleService(scene);
    this.particleAnimationService = new ParticleAnimationService(scene);
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
    if (!timelineElement || !gameObject) return;

    // Handle particle creation if needed
    if (timelineElement.assetType === "particle") {
      gameObject = this.particleService.createParticleSystem(
        timelineElement,
        assetElement
      );
      if (!gameObject) return;
    }

    // Prepare container once
    const container = this.prepareContainer(
      gameObject,
      timelineElement,
      assetElement
    );

    const pivotX = assetElement?.pivot_override?.x || 0.5;
    const pivotY = assetElement?.pivot_override?.y || 0.5;

    if (timelineElement.assetType === "particle") {
      // For particles, update their emission point relative to the container
      const particleService = new ParticleAnimationService(this.scene);
      const emitter = gameObject as GameObjects.Particles.ParticleEmitter;

      // Set emitter position relative to container
      emitter.setPosition(-pivotX, -pivotY);
      container.add(emitter);

      // Apply particle animations
      particleService.applyParticleAnimations(
        emitter,
        container,
        timelineElement
      );
    } else {
      const regularObject = gameObject as
        | GameObjects.Sprite
        | GameObjects.Image;
      regularObject.setPosition(-pivotX, -pivotY);
      container.add(regularObject);
      this.applyRegularAnimations(container, regularObject, timelineElement);
    }

    this.applyVisibilityAnimations(gameObject, timelineElement);
  }

  private prepareContainer(
    gameObject:
      | GameObjects.Sprite
      | GameObjects.Image
      | GameObjects.Particles.ParticleEmitter,
    timelineElement: TimelineElement,
    assetElement?: AssetElement
  ) {
    const originalX = gameObject.x;
    const originalY = gameObject.y;
    const originalDepth = gameObject.depth;

    const container = this.scene.add.container(originalX, originalY);
    container.setDepth(originalDepth);

    return container;
  }

  private applyRegularAnimations(
    container: Phaser.GameObjects.Container,
    gameObject: GameObjects.Sprite | GameObjects.Image,
    timelineElement: TimelineElement
  ) {
    const timeline = timelineElement.timeline;

    if (timeline?.scale) this.applyScaleAnimation(container, timeline.scale[0]);
    if (timeline?.position)
      this.applyPositionAnimation(container, timeline.position[0]);
    if (timeline?.opacity)
      this.applyOpacityAnimation(gameObject, timeline.opacity[0]);
    if (timeline?.rotation)
      this.applyRotationAnimation(container, timeline.rotation[0]);
    if (timeline?.color) {
      this.applyColorAnimation(gameObject, timeline.color[0]);
    }
  }

  private applyScaleAnimation(target: Phaser.GameObjects.Container, anim: any) {
    if (!anim) return;

    this.scene.tweens.add({
      targets: target,
      scaleX: anim.endValue.x,
      scaleY: anim.endValue.y,
      duration: (anim.endTime - anim.startTime) * 1000,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
    });
  }

  private applyPositionAnimation(
    target: Phaser.GameObjects.Container,
    anim: any
  ) {
    if (!anim) return;

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    const tweenConfig: any = {
      targets: target,
      duration: (anim.endTime - anim.startTime) * 1000,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
    };

    if (anim.endValue.x !== undefined) {
      tweenConfig.x = (anim.endValue.x / 1920) * screenWidth;
    }
    if (anim.endValue.y !== undefined) {
      tweenConfig.y = (anim.endValue.y / 1080) * screenHeight;
    }
    if (anim.endValue.z !== undefined) {
      const startZ =
        anim.startValue?.z !== undefined
          ? Math.round(anim.startValue.z)
          : target.depth;
      tweenConfig.depth = {
        from: startZ,
        to: Math.round(anim.endValue.z),
      };
    }

    this.scene.tweens.add(tweenConfig);
  }

  private applyOpacityAnimation(
    target: GameObjects.Sprite | GameObjects.Image,
    anim: any
  ) {
    if (!anim) return;

    this.scene.tweens.add({
      targets: target,
      alpha: anim.endValue,
      duration: (anim.endTime - anim.startTime) * 1000,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
    });
  }

  private applyRotationAnimation(
    target: Phaser.GameObjects.Container,
    anim: any
  ) {
    if (!anim) return;

    this.scene.tweens.add({
      targets: target,
      angle: anim.endValue,
      duration: (anim.endTime - anim.startTime) * 1000,
      ease: anim.easeIn || "Linear",
      delay: anim.startTime * 1000,
    });
  }

  private applyColorAnimation(
    target: GameObjects.Sprite | GameObjects.Image,
    anim: any
  ) {
    if (!anim) return;

    const startColor = parseInt(anim.startValue.replace("0x", ""), 16);
    const endColor = parseInt(anim.endValue.replace("0x", ""), 16);

    target.setTint(startColor);

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
        target.setTint(currentColor);
      },
    });
  }

  private applyVisibilityAnimations(
    gameObject:
      | GameObjects.Sprite
      | GameObjects.Image
      | GameObjects.Particles.ParticleEmitter,
    timelineElement: TimelineElement
  ) {
    if (!timelineElement.onScreen) {
      gameObject.setAlpha(1);
      return;
    }

    gameObject.setAlpha(0);
    timelineElement.onScreen.forEach((screen) => {
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
  }

  public cleanup(): void {
    this.particleService.cleanup();
  }
}
