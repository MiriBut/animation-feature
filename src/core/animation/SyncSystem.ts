import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SequenceSystem, SequenceItem } from "./SequenceSystem";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";

export interface SyncGroup {
  target:
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Particles.ParticleEmitter
    | Phaser.Sound.WebAudioSound
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Container;
  sequence: SequenceItem[] | AudioConfig;
}

export class SyncSystem {
  private animationManager: AnimationManager;
  private sequenceSystem: SequenceSystem;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
    this.sequenceSystem = new SequenceSystem(scene);
  }

  async playSync(groups: SyncGroup[]): Promise<void> {
    const promises = groups.map((group) => {
      // מקרה 1: אם האודיו מגיע כאובייקט AudioConfig בודד
      if (
        !Array.isArray(group.sequence) &&
        typeof group.sequence === "object" &&
        group.sequence !== null &&
        (("property" in group.sequence &&
          group.sequence.property === "audio") ||
          "audioKey" in group.sequence)
      ) {
        console.log("Audio config detected directly");
        const audioSequence: SequenceItem[] = [
          {
            type: "audio" as AnimationPropertyType,
            config: group.sequence as AudioConfig,
            delay: (group.sequence as AudioConfig).delay || 0,
          },
        ];
        return this.sequenceSystem.playSequence(group.target, audioSequence);
      }
      // מקרה 2: אם זה מערך שמכיל אנימציית אודיו
      else if (Array.isArray(group.sequence)) {
        console.log("Checking sequence array for audio items...");

        // בדוק אם יש פריטי אודיו במערך
        const audioItems = group.sequence.filter(
          (item) => item.type === "audio"
        );
        if (audioItems.length > 0) {
          console.log(`Found ${audioItems.length} audio items in sequence`);
        }

        return this.sequenceSystem.playSequence(
          group.target,
          group.sequence as SequenceItem[]
        );
      } else {
        console.log("Unknown sequence format:", group.sequence);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
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

  stopAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.stopAnimations(target);
    });
  }

  pauseAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.pauseAnimations(target);
    });
  }

  resumeAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.resumeAnimations(target);
    });
  }

  resetAll(targets: Phaser.GameObjects.GameObject[]): void {
    targets.forEach((target) => {
      this.animationManager.resetAnimations(target);
    });
  }
}
