// src/core/animation/AnimationManager.ts
import { Scene } from "phaser";
import {
  AnimationPropertyType,
  IAnimatable,
  AnimatableGameObject,
  AnimationConfig,
} from "./types";
import { AnimationRegistry } from "./AnimationRegistory";
import { ObjectIdGenerator } from "./utiles";

export interface AnimationQueueItem {
  type: AnimationPropertyType;
  config: AnimationConfig;
}

export class AnimationManager {
  private registry: AnimationRegistry;
  // מיפוי אובייקט -> סוג אנימציה -> אנימציה פעילה
  private activeAnimations: Map<string, Map<string, IAnimatable>> = new Map();
  private animationQueue: Map<string, AnimationQueueItem[]> = new Map();

  constructor(private scene: Scene) {
    this.registry = AnimationRegistry.getInstance();
    //console.log(`[${new Date().toISOString()}] AnimationManager: Initialized`);
  }

  // מתחיל אנימציה חדשה על אובייקט
  async animate(
    target: Phaser.GameObjects.GameObject,
    type: AnimationPropertyType,
    config: AnimationConfig
  ): Promise<void> {
    const objectId = this.getObjectId(target);

    const objectAnimations = this.activeAnimations.get(objectId) || new Map();

    // אם יש אנימציה קיימת מאותו סוג, עצור אותה
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
      // יצירת האנימציה
      const animation = this.registry.createAnimation(type, this.scene, target);

      // שמירת האנימציה במיפוי
      if (!this.activeAnimations.has(objectId)) {
        this.activeAnimations.set(objectId, new Map());
      }

      this.activeAnimations.get(objectId)?.set(type, animation);

      const actualStartTime = Date.now();
      console.log(
        `AnimationManager: Animation ${type} for ${objectId} actual start at ${actualStartTime}`
      );

      // הפעלת האנימציה
      await animation.play(config);

      // אחרי שהאנימציה הסתיימה
      console.log(
        `AnimationManager: Animation ${type} for ${objectId} completed after ${
          Date.now() - actualStartTime
        }ms`
      );

      // הסרה מהמיפוי
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

  // עוצר את כל האנימציות על אובייקט
  stopAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Stopping all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // עצור את כל האנימציות
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Stopping ${type} animation for ${objectId}`
        );
        animation.stop();
      });
      this.activeAnimations.delete(objectId);
    }

    // ניקוי התור
    this.animationQueue.delete(objectId);
  }

  // משהה את כל האנימציות על אובייקט
  pauseAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Pausing all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // השהה את כל האנימציות
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Pausing ${type} animation for ${objectId}`
        );
        animation.pause();
      });
    }
  }

  // ממשיך אנימציות שהושהו
  resumeAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Resuming all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // המשך את כל האנימציות
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Resuming ${type} animation for ${objectId}`
        );
        animation.resume();
      });
    }
  }

  // מאפס את כל האנימציות לאובייקט
  resetAnimations(target: Phaser.GameObjects.GameObject): void {
    const objectId = this.getObjectId(target);
    console.log(`AnimationManager: Resetting all animations for ${objectId}`);

    const objectAnimations = this.activeAnimations.get(objectId);
    if (objectAnimations) {
      // אפס את כל האנימציות
      objectAnimations.forEach((animation, type) => {
        console.log(
          `AnimationManager: Resetting ${type} animation for ${objectId}`
        );
        animation.reset();
      });
      this.activeAnimations.delete(objectId);
    }

    // ניקוי התור
    this.animationQueue.delete(objectId);
  }

  // בודק אם יש אנימציה פעילה על אובייקט
  hasActiveAnimation(
    target: Phaser.GameObjects.GameObject,
    type?: AnimationPropertyType
  ): boolean {
    const objectId = this.getObjectId(target);
    const objectAnimations = this.activeAnimations.get(objectId);

    if (!objectAnimations) {
      return false;
    }

    // אם סוג ספציפי הוגדר, בדוק רק אותו
    if (type) {
      return objectAnimations.has(type);
    }

    // אחרת, בדוק אם יש אנימציות פעילות בכלל
    return objectAnimations.size > 0;
  }

  // מקבל את כל האנימציות בתור לאובייקט
  getQueuedAnimations(
    target: Phaser.GameObjects.GameObject
  ): AnimationQueueItem[] {
    return this.animationQueue.get(this.getObjectId(target)) || [];
  }

  // מקבל את כל האנימציות הפעילות לאובייקט
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
}
