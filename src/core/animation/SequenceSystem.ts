// src/core/animation/SequenceSystem.ts
import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig;
  delay?: number; // עיכוב לפני הפעלת האנימציה
}

export class SequenceSystem {
  private animationManager: AnimationManager;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
  }

  /**
   * מפעיל רצף אנימציות על אובייקט מטרה
   *
   * @param target האובייקט עליו יופעלו האנימציות
   * @param sequence רצף האנימציות להפעלה
   */
  async playSequence(
    target: Phaser.GameObjects.GameObject | Phaser.Sound.BaseSound,
    sequence: SequenceItem[]
  ): Promise<void> {
    const trackMap: Map<string, number> = new Map(); // שמירת מסלולים ל-Spine בלבד
    let nextTrack = 0; // המסלול הבא לשימוש ב-Spine

    const promises = sequence.map((item) => {
      return new Promise<void>((resolve) => {
        const {
          animationName,
          loop,
          delay = 0,
          duration,
        } = item.config as AnimationConfig;

        if (!animationName) {
          console.warn("⚠️ Missing animationName, skipping.");
          resolve();
          return;
        }

        setTimeout(async () => {
          try {
            if (target instanceof SpineGameObject) {
              // 🎭 **Spine** → ניהול מסלולים דינמי
              let trackIndex = trackMap.has(animationName)
                ? trackMap.get(animationName)!
                : nextTrack;
              if (!trackMap.has(animationName)) {
                trackMap.set(animationName, trackIndex);
                nextTrack++; // שמירת מסלול חדש לשימוש הבא
              }

              console.log(
                `Spine: Playing ${animationName} on track ${trackIndex}`
              );
              const trackEntry = target.animationState.setAnimation(
                trackIndex,
                animationName,
                loop === "true"
              );

              if (duration && loop !== "true") {
                target.scene.time.delayedCall(duration, () => {
                  target.animationState.setEmptyAnimation(trackIndex, 0);
                  trackMap.delete(animationName);
                });
              }
            } else if (target instanceof Phaser.GameObjects.Sprite) {
              // 🎭 **פייזר רגיל** → שימוש באנימציות של sprite
              console.log(`Sprite: Playing ${animationName}`);
              target.play(animationName);
            } else if (target instanceof Phaser.Sound.BaseSound) {
              // 🎭 **סאונד** → הפעלה של קובץ קול
              console.log(`Sound: Playing ${animationName}`);
              target.play();
            } else {
              console.warn(`Unknown animation type for ${animationName}`);
            }

            resolve();
          } catch (error) {
            console.error(`Animation error for ${animationName}:`, error);
            resolve();
          }
        }, delay);
      });
    });

    await Promise.all(promises);
  }

  /**
   * עוצר את רצף האנימציות
   */
  stopSequence(target: Phaser.GameObjects.GameObject): void {
    this.animationManager.stopAnimations(target);
  }

  /**
   * משהה את רצף האנימציות
   */
  pauseSequence(target: Phaser.GameObjects.GameObject): void {
    this.animationManager.pauseAnimations(target);
  }

  /**
   * ממשיך רצף שהושהה
   */
  resumeSequence(target: Phaser.GameObjects.GameObject): void {
    this.animationManager.resumeAnimations(target);
  }

  /**
   * עוצר את כל רצפי האנימציות לכל האובייקטים
   */
  stopAllSequences(): void {
    console.log("SequenceSystem: Stopping all sequences for all objects");
    // כיוון שאין לנו גישה ישירה לכל האובייקטים,
    // נסמוך על AnimationManager לעצור את כל האנימציות הפעילות

    // אם יש לך רשימה של אובייקטים פעילים, אתה יכול לעבור עליהם ולעצור את הרצפים:
    // this.activeTargets.forEach(target => {
    //   this.stopSequence(target);
    // });
  }

  /**
   * מנקה את כל הרצפים מהמערכת
   */
  clearAllSequences(): void {
    console.log("SequenceSystem: Clearing all sequences");

    // כאן אפשר לנקות כל מבנה נתונים פנימי שמחזיק מידע על רצפים
    // לדוגמה, אם יש לך מפה או מערך של רצפים פעילים:
    // this.activeSequences.clear();
  }
}
