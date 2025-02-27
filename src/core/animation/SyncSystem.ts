// src/core/animation/SyncSystem.ts
import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SequenceSystem, SequenceItem } from "./SequenceSystem";

export interface SyncGroup {
  target: Phaser.GameObjects.GameObject;
  sequence: SequenceItem[];
}

export class SyncSystem {
  private animationManager: AnimationManager;
  private sequenceSystem: SequenceSystem;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
    this.sequenceSystem = new SequenceSystem(scene);
    console.log(`[${new Date().toISOString()}] SyncSystem: Initialized`);
  }

  /**
   * מריץ אנימציות במקביל על מספר אובייקטים
   */
  async playSync(groups: SyncGroup[]): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Starting animation playback for ${
        groups.length
      } groups`
    );

    // לוג מידע על כל אובייקט וכמות האנימציות שלו
    groups.forEach((group) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Group for ${
          group.target.name || "unnamed object"
        } has ${group.sequence.length} animations`
      );
    });

    // מריץ את כל הרצפים במקביל
    const startTime = Date.now();
    const promises = groups.map((group) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Starting sequence for ${
          group.target.name || "unnamed object"
        }`
      );
      return this.sequenceSystem.playSequence(group.target, group.sequence);
    });

    // מחכה שכל האנימציות יסתיימו
    await Promise.all(promises);

    const endTime = Date.now();
    console.log(
      `[${new Date().toISOString()}] SyncSystem: All animations completed after ${
        endTime - startTime
      }ms`
    );
  }

  /**
   * מריץ אנימציה בודדת על מספר אובייקטים בו-זמנית
   */
  async animateMultiple(
    targets: Phaser.GameObjects.GameObject[],
    type: AnimationPropertyType,
    config: AnimationConfig
  ): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Animating ${type} on ${
        targets.length
      } objects simultaneously`
    );

    const startTime = Date.now();
    const promises = targets.map((target) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Starting ${type} animation for ${
          target.name || "unnamed object"
        }`
      );
      return this.animationManager.animate(target, type, config);
    });

    await Promise.all(promises);

    const endTime = Date.now();
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Multiple ${type} animations completed after ${
        endTime - startTime
      }ms`
    );
  }

  /**
   * עוצר את כל האנימציות בקבוצה
   */
  stopAll(targets: Phaser.GameObjects.GameObject[]): void {
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Stopping all animations for ${
        targets.length
      } objects`
    );

    targets.forEach((target) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Stopping animations for ${
          target.name || "unnamed object"
        }`
      );
      this.animationManager.stopAnimations(target);
    });
  }

  /**
   * משהה את כל האנימציות בקבוצה
   */
  pauseAll(targets: Phaser.GameObjects.GameObject[]): void {
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Pausing all animations for ${
        targets.length
      } objects`
    );

    targets.forEach((target) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Pausing animations for ${
          target.name || "unnamed object"
        }`
      );
      this.animationManager.pauseAnimations(target);
    });
  }

  /**
   * ממשיך את כל האנימציות שהושהו בקבוצה
   */
  resumeAll(targets: Phaser.GameObjects.GameObject[]): void {
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Resuming all animations for ${
        targets.length
      } objects`
    );

    targets.forEach((target) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Resuming animations for ${
          target.name || "unnamed object"
        }`
      );
      this.animationManager.resumeAnimations(target);
    });
  }

  /**
   * מאפס את כל האנימציות בקבוצה
   */
  resetAll(targets: Phaser.GameObjects.GameObject[]): void {
    console.log(
      `[${new Date().toISOString()}] SyncSystem: Resetting all animations for ${
        targets.length
      } objects`
    );

    targets.forEach((target) => {
      console.log(
        `[${new Date().toISOString()}] SyncSystem: Resetting animations for ${
          target.name || "unnamed object"
        }`
      );
      this.animationManager.resetAnimations(target);
    });
  }
}
