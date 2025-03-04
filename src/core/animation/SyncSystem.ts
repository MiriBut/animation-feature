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
  }

  /**
   * מריץ אנימציות במקביל על מספר אובייקטים
   */
  async playSync(groups: SyncGroup[]): Promise<void> {
    console.log(
      `SyncSystem: Starting animation playback for ${groups.length} groups`
    );

    // לוג מידע על כל אובייקט וכמות האנימציות שלו
    groups.forEach((group) => {
      console.log(
        `SyncSystem: Group for ${group.target.name || "unnamed object"} has ${
          group.sequence.length
        } animations`
      );
    });

    // מריץ את כל הרצפים במקביל
    const startTime = Date.now();
    const promises = groups.map((group) => {
      console.log(
        `SyncSystem: Starting sequence for ${
          group.target.name || "unnamed object"
        }`
      );
      return this.sequenceSystem.playSequence(group.target, group.sequence);
    });

    // מחכה שכל האנימציות יסתיימו
    await Promise.all(promises);

    const endTime = Date.now();
  }

  /**
   * מריץ אנימציה בודדת על מספר אובייקטים בו-זמנית
   */
  async animateMultiple(
    targets: Phaser.GameObjects.GameObject[],
    type: AnimationPropertyType,
    config: AnimationConfig
  ): Promise<void> {
    const startTime = Date.now();
    const promises = targets.map((target) => {
      return this.animationManager.animate(target, type, config);
    });

    await Promise.all(promises);

    const endTime = Date.now();
    console.log(
      `SyncSystem: Multiple ${type} animations completed after ${
        endTime - startTime
      }ms`
    );
  }

  /**
   * עוצר את כל האנימציות בקבוצה
   */
  stopAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.stopAnimations(target);
    });
  }

  /**
   * משהה את כל האנימציות בקבוצה
   */
  pauseAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.pauseAnimations(target);
    });
  }

  /**
   * ממשיך את כל האנימציות שהושהו בקבוצה
   */
  resumeAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.resumeAnimations(target);
    });
  }

  /**
   * מאפס את כל האנימציות בקבוצה
   */
  resetAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      // console.log(
      //   `[${new Date().toISOString()}] SyncSystem: Resetting animations for ${
      //     target.name || "unnamed object"
      //   }`
      // );
      this.animationManager.resetAnimations(target);
    });
  }
}
