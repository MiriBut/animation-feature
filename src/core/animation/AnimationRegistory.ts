// src/core/animation/AnimationRegistry.ts
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
    // בדיקה אם מדובר באובייקט וידאו
    if (target instanceof Phaser.GameObjects.Video) {
      // אפשר גם סקיילינג לוידאו, אבל לא רוטציה וצבע
      if (type !== "position" && type !== "opacity" && type !== "scale") {
        throw new Error(
          `Animation type ${type} not supported for Video objects`
        );
      }
    }

    // וידאים אם מדובר באובייקט מונפש
    if (
      !(target instanceof Phaser.GameObjects.Sprite) &&
      !(target instanceof Phaser.GameObjects.Image) &&
      !(target instanceof Phaser.GameObjects.Video) &&
      !(target instanceof SpineGameObject)
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
