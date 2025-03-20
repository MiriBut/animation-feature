// src/core/animation/SequenceSystem.ts
import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";

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
    target: Phaser.GameObjects.GameObject | Phaser.Sound.WebAudioSound,
    sequence: SequenceItem[]
  ): Promise<void> {
    // console.log(
    //   `[${new Date().toISOString()}] SequenceSystem: Playing sequence with ${
    //     sequence.length
    //   } items for ${target.name || "unnamed object"}`
    // );
    // לוג מידע על כל אנימציה בסדרה
    sequence.forEach((item) => {
      console.log("Playing sequence item:", JSON.stringify(item, null, 2));

      const startTimeMs = item.config.delay || 0;
      const durationMs = item.config.duration || 0;
      console.log(
        `SequenceSystem: Animation ${item.type} scheduled to start at ${startTimeMs}ms, duration: ${durationMs}ms`
      );
    });

    // הפעל את כל האנימציות במקביל ואסוף את ה-promises
    const promises = sequence.map((item) => {
      // יצירת עותק של קונפיגורציה כדי לא לשנות את המקור
      const config = { ...item.config };

      // אנימציה שאמורה להתחיל מאוחר יותר מטופלת באמצעות setTimeout
      // כך כל האנימציות מופעלות במקביל עם ה-delay המתאים
      return new Promise<void>((resolve) => {
        const delay = config.delay || 0;

        // להמתין delay מילישניות לפני הרצת האנימציה
        setTimeout(async () => {
          // אחרי ההמתנה, הפעל את האנימציה ללא delay (כבר חיכינו)
          config.delay = 0;

          try {
            await this.animationManager.animate(target, item.type, config);
            resolve();
          } catch (error) {
            console.error(`Animation error for ${item.type}:`, error);
            resolve(); // resolve למרות השגיאה כדי לא לתקוע את האנימציות האחרות
          }
        }, delay);
      });
    });

    // המתן שכל האנימציות יסתיימו
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
