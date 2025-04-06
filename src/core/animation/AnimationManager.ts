import { Scene } from "phaser";
import {
  AnimationPropertyType,
  IAnimatable,
  AnimatableGameObject,
  AnimationConfig,
  AudioConfig,
} from "./types";
import { AnimationRegistry } from "./AnimationRegistory";
import { ObjectIdGenerator } from "./utiles";

export interface AnimationQueueItem {
  type: AnimationPropertyType;
  config: AnimationConfig;
}

export class AnimationManager {
  private registry: AnimationRegistry;
  private activeAnimations: Map<string, Map<string, IAnimatable>> = new Map();
  private animationQueue: Map<string, AnimationQueueItem[]> = new Map();

  constructor(private scene: Scene) {
    this.registry = AnimationRegistry.getInstance();
  }

  async animate(
    target: Phaser.GameObjects.GameObject | any,
    type: AnimationPropertyType,
    config: AnimationConfig | AudioConfig
  ): Promise<void> {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId) || new Map();

    if (objectAnimations.has(type)) {
      console.log(
        `AnimationManager: Stopping previous ${type} animation for ${objectId}`
      );
      const previousAnimation = objectAnimations.get(type);
      if (previousAnimation) {
        previousAnimation.stop();
      }
      objectAnimations.delete(type);
    }

    try {
      const animation = this.registry.createAnimation(type, this.scene, target);

      if (!this.activeAnimations.has(objectId)) {
        this.activeAnimations.set(objectId, new Map());
      }

      this.activeAnimations.get(objectId)?.set(type, animation);

      const actualStartTime = Date.now();
      console.log(
        `📌 AnimationManager: Animation ${type} for ${objectId} actual start at ${actualStartTime}`
      );

      await animation.play(config);

      console.log(
        `🎯 AnimationManager: Animation ${type} for ${objectId} completed after ${
          Date.now() - actualStartTime
        }ms`
      );

      this.activeAnimations.get(objectId)?.delete(type);
      if (this.activeAnimations.get(objectId)?.size === 0) {
        this.activeAnimations.delete(objectId);
      }
    } catch (error) {
      console.error(
        `Animation error for object ${objectId}, type ${type}:`,
        error
      );
      this.activeAnimations.get(objectId)?.delete(type);
      if (this.activeAnimations.get(objectId)?.size === 0) {
        this.activeAnimations.delete(objectId);
      }
      throw error;
    }
  }

  stopAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // Stop all animations
      objectAnimations.forEach((animation, type) => {
        animation.stop();
      });
      this.activeAnimations.delete(objectId);
    }

    // Clear the queue
    this.animationQueue.delete(objectId);
  }

  pauseAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      objectAnimations.forEach((animation, type) => {
        animation.pause();
      });
    }
  }

  resumeAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      objectAnimations.forEach((animation, type) => {
        // console.log(
        //   `AnimationManager: Resuming ${type} animation for ${objectId}`
        // );
        animation.resume();
      });
    }
  }

  resetAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      objectAnimations.forEach((animation, type) => {
        // console.log(
        //   `AnimationManager: Resetting ${type} animation for ${objectId}`
        // );
        animation.reset();
      });
      this.activeAnimations.delete(objectId);
    }

    this.animationQueue.delete(objectId);
  }

  hasActiveAnimation(
    target: Phaser.GameObjects.GameObject,
    type?: AnimationPropertyType
  ): boolean {
    const objectId = this.getObjectId(target);
    const objectAnimations = this.activeAnimations.get(objectId);

    if (!objectAnimations) {
      return false;
    }

    // If a specific type is defined, check only that one
    if (type) {
      return objectAnimations.has(type);
    }

    // Otherwise, check if there are any active animations at all
    return objectAnimations.size > 0;
  }

  getQueuedAnimations(
    target: Phaser.GameObjects.GameObject
  ): AnimationQueueItem[] {
    return this.animationQueue.get(this.getObjectId(target)) || [];
  }

  getActiveAnimationTypes(
    target: Phaser.GameObjects.GameObject
  ): AnimationPropertyType[] {
    const objectId = this.getObjectId(target);
    const objectAnimations = this.activeAnimations.get(objectId);

    if (!objectAnimations) {
      return [];
    }

    return Array.from(objectAnimations.keys()) as AnimationPropertyType[];
  }

  private getObjectId(target: Phaser.GameObjects.GameObject): string {
    return target.name || ObjectIdGenerator.getId(target);
  }

  stopAll(): void {
    // Go through all objects with active animations and stop them
    this.activeAnimations.forEach((animations, objectId) => {
      // Stop all animations for the object
      animations.forEach((animation, type) => {
        animation.stop();
      });
    });

    this.activeAnimations.clear();

    this.animationQueue.clear();
  }
}
