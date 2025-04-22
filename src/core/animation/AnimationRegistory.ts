import { Scene } from "phaser";
import {
  AnimationPropertyType,
  AnimatableGameObject,
  IAnimatable,
} from "./types";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";

export class AnimationRegistry {
  private static instance: AnimationRegistry;
  private animations = new Map<
    AnimationPropertyType,
    new (scene: Scene, target: AnimatableGameObject) => IAnimatable
  >();

  private constructor() {}

  static getInstance(): AnimationRegistry {
    if (!AnimationRegistry.instance) {
      AnimationRegistry.instance = new AnimationRegistry();
    }
    return AnimationRegistry.instance;
  }

  register(
    type: AnimationPropertyType,
    animationClass: new (
      scene: Scene,
      target: AnimatableGameObject
    ) => IAnimatable
  ): void {
    this.animations.set(type, animationClass);
  }

  createAnimation(
    type: AnimationPropertyType,
    scene: Scene,
    target: Phaser.GameObjects.GameObject
  ): IAnimatable {
    if (type === "audio") {
      if (
        target instanceof Phaser.Sound.WebAudioSound ||
        target instanceof Phaser.Sound.HTML5AudioSound
      ) {
        const AudioAnimation = this.animations.get("audio");
        if (!AudioAnimation) {
          throw new Error(`Animation type audio not registered`);
        }
        return new AudioAnimation(scene, target as AnimatableGameObject);
      } else {
        throw new Error(
          `Object of type ${
            target?.constructor?.name || "undefined"
          } does not support audio animations`
        );
      }
    }

    // Check if this is a video object
    if (target instanceof Phaser.GameObjects.Video) {
      // We can do scaling for video, but not rotation or color
      if (
        type !== "position" &&
        type !== "opacity" &&
        type !== "scale" &&
        type != "visibility"
      ) {
        throw new Error(
          `Animation type ${type} not supported for Video objects`
        );
      }
    }

    if (target instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
      if (type !== "position" && type !== "opacity") {
        throw new Error(
          `Animation type ${type} not supported for ParticleEmitter objects`
        );
      }
    }

    // Verify if this is an animatable object
    if (
      !(target instanceof Phaser.GameObjects.Sprite) &&
      !(target instanceof Phaser.GameObjects.Image) &&
      !(target instanceof Phaser.GameObjects.Video) &&
      !(target instanceof SpineGameObject) &&
      !(target instanceof Phaser.GameObjects.Particles.ParticleEmitter) &&
      !(target instanceof Phaser.GameObjects.Text)
    ) {
      throw new Error(
        `Object of type ${target.type} does not support animations`
      );
    }

    const AnimationClass = this.animations.get(type);
    if (!AnimationClass) {
      throw new Error(`Animation type ${type} not registered`);
    }

    return new AnimationClass(scene, target as AnimatableGameObject);
  }

  hasAnimationType(type: AnimationPropertyType): boolean {
    return this.animations.has(type);
  }

  getRegisteredTypes(): AnimationPropertyType[] {
    return Array.from(this.animations.keys());
  }
}
