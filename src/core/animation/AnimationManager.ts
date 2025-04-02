// src/core/animation/AnimationManager.ts
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
  // Mapping: object -> animation type -> active animation
  private activeAnimations: Map<string, Map<string, IAnimatable>> = new Map();
  private animationQueue: Map<string, AnimationQueueItem[]> = new Map();

  constructor(private scene: Scene) {
    this.registry = AnimationRegistry.getInstance();
    //console.log(`[${new Date().toISOString()}] AnimationManager: Initialized`);
  }

  // Starts a new animation on an object
  async animate(
    target: Phaser.GameObjects.GameObject | any,
    type: AnimationPropertyType,
    config: AnimationConfig | AudioConfig
  ): Promise<void> {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId) || new Map();

    // If there's an existing animation of the same type, stop it
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
      // Create the animation
      const animation = this.registry.createAnimation(type, this.scene, target);

      // Store the animation in the mapping
      if (!this.activeAnimations.has(objectId)) {
        this.activeAnimations.set(objectId, new Map());
      }

      this.activeAnimations.get(objectId)?.set(type, animation);

      const actualStartTime = Date.now();
      console.log(
        `AnimationManager: Animation ${type} for ${objectId} actual start at ${actualStartTime}`
      );

      // Start the animation
      await animation.play(config);

      // After the animation is complete
      console.log(
        `AnimationManager: Animation ${type} for ${objectId} completed after ${
          Date.now() - actualStartTime
        }ms`
      );

      // Remove from mapping
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

  // Stops all animations on an object
  stopAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Stopping all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // Stop all animations
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Stopping ${type} animation for ${objectId}`
        );
        animation.stop();
      });
      this.activeAnimations.delete(objectId);
    }

    // Clear the queue
    this.animationQueue.delete(objectId);
  }

  // Pauses all animations on an object
  pauseAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Pausing all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // Pause all animations
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Pausing ${type} animation for ${objectId}`
        );
        animation.pause();
      });
    }
  }

  // Resumes paused animations
  resumeAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Resuming all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // Resume all animations
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Resuming ${type} animation for ${objectId}`
        );
        animation.resume();
      });
    }
  }

  // Resets all animations for an object
  resetAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Resetting all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // Reset all animations
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Resetting ${type} animation for ${objectId}`
        );
        animation.reset();
      });
      this.activeAnimations.delete(objectId);
    }

    // Clear the queue
    this.animationQueue.delete(objectId);
  }

  // Checks if there is an active animation on an object
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

  // Gets all animations in the queue for an object
  getQueuedAnimations(
    target: Phaser.GameObjects.GameObject
  ): AnimationQueueItem[] {
    return this.animationQueue.get(this.getObjectId(target)) || [];
  }

  // Gets all active animations for an object
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

  private addToQueue(objectId: string, item: AnimationQueueItem): void {
    const queue = this.animationQueue.get(objectId) || [];
    queue.push(item);
    this.animationQueue.set(objectId, queue);
    console.log(
      `AnimationManager: Added ${item.type} animation to queue for ${objectId}`
    );
  }

  private async playNextInQueue(objectId: string): Promise<void> {
    const queue = this.animationQueue.get(objectId);
    if (!queue || queue.length === 0) return;

    const nextAnimation = queue.shift();
    this.animationQueue.set(objectId, queue);

    if (nextAnimation) {
      console.log(
        `AnimationManager: Playing next queued animation ${nextAnimation.type} for ${objectId}`
      );
      const target = this.findObjectById(objectId);
      if (target) {
        await this.animate(target, nextAnimation.type, nextAnimation.config);
      }
    }
  }

  private findObjectById(
    objectId: string
  ): Phaser.GameObjects.GameObject | undefined {
    return this.scene.children
      .getAll()
      .find((obj) => this.getObjectId(obj) === objectId);
  }

  /**
   * Stops all animations on all objects
   */
  stopAll(): void {
    console.log("AnimationManager: Stopping all animations for all objects");

    // Go through all objects with active animations and stop them
    this.activeAnimations.forEach((animations, objectId) => {
      console.log(`AnimationManager: Stopping all animations for ${objectId}`);

      // Stop all animations for the object
      animations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Stopping ${type} animation for ${objectId}`
        );
        animation.stop();
      });
    });

    // Clear the active animations mapping
    this.activeAnimations.clear();

    // Clear the animation queue
    this.animationQueue.clear();
  }
}
