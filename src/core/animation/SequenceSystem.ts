// src/core/animation/SequenceSystem.ts
import { Scene } from "phaser";
import { AnimationPropertyType, AnimationConfig, AudioConfig } from "./types";
import { AnimationManager } from "./AnimationManager";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig;
  delay?: number;
}

export class SequenceSystem {
  private animationManager: AnimationManager;
  private activeSpineObjects: Set<SpineGameObject> = new Set();
  private spineTrackMap: Map<string, number> = new Map();
  private spineNextTrack: number = 0;

  constructor(scene: Scene) {
    this.animationManager = new AnimationManager(scene);
  }

  private isSpineObject(obj: any): boolean {
    return obj && obj instanceof SpineGameObject && !!obj.animationState;
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
    // לוג מידע על כל אנימציה בסדרה
    sequence.forEach((item) => {
      console.log("Playing sequence item:", JSON.stringify(item, null, 2));

      const startTimeMs = item.config.delay || 0;
      const durationMs = item.config.duration || 0;
      console.log(
        `SequenceSystem: Animation ${item.type} scheduled to start at ${startTimeMs}ms, duration: ${durationMs}ms`
      );
    });

    // אתחול מפת ה-tracks לאנימציות Spine עבור רצף חדש אם מדובר באובייקט Spine
    if (this.isSpineObject(target)) {
      this.activeSpineObjects.add(target as SpineGameObject);
      this.spineTrackMap.clear();
      this.spineNextTrack = 0;
    }

    // בדיקה אם יש אנימציות Spine
    const hasSpineItems =
      this.isSpineObject(target) &&
      sequence.some((item) => item.type === "spine");

    // אם אין אנימציות Spine, נשתמש בקוד המקורי
    if (!hasSpineItems) {
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
      return;
    }

    // אם יש אנימציות Spine, נטפל בהן בנפרד
    // מיון הפריטים לפי סוג
    const spineItems = sequence.filter((item) => item.type === "spine");
    const nonSpineItems = sequence.filter((item) => item.type !== "spine");

    // טיפול באנימציות Spine במקביל
    if (spineItems.length > 0 && this.isSpineObject(target)) {
      const spineTarget = target as SpineGameObject;
      const spinePromises = spineItems.map((item) => {
        const config = { ...item.config };
        const animName = (config as AnimationConfig).animationName || "";
        const delay = item.delay || 0;

        return new Promise<void>((resolve) => {
          setTimeout(() => {
            try {
              if (!animName) {
                console.warn(
                  "Spine animation requires animationName, skipping"
                );
                resolve();
                return;
              }

              // קבל או הקצה מספר track
              const trackIndex =
                this.spineTrackMap.get(animName) ?? this.spineNextTrack++;
              this.spineTrackMap.set(animName, trackIndex);

              const shouldLoop = config.loop === true || config.loop === "true";

              // טיפול במיזוג בין אנימציות
              if (trackIndex > 0) {
                const previousAnim = spineTarget.animationState.getCurrent(
                  trackIndex - 1
                );
                if (previousAnim && previousAnim.animation) {
                  spineTarget.animationStateData.setMix(
                    previousAnim.animation.name,
                    animName,
                    0.2
                  );
                }
              }

              // הפעלת האנימציה
              spineTarget.animationState.setAnimation(
                trackIndex,
                animName,
                shouldLoop
              );

              // עצירה לאחר duration אם לא בלולאה
              if (config.duration && !shouldLoop) {
                setTimeout(() => {
                  if (this.activeSpineObjects.has(spineTarget)) {
                    spineTarget.animationState.setEmptyAnimation(trackIndex, 0);
                  }
                }, config.duration);
              }

              resolve();
            } catch (error) {
              console.error(`Spine animation error:`, error);
              resolve();
            }
          }, delay);
        });
      });

      // הפעל את אנימציות Spine במקביל
      await Promise.all(spinePromises);
    }

    // טיפול בשאר האנימציות בקוד זהה למקורי
    if (nonSpineItems.length > 0) {
      const promises = nonSpineItems.map((item) => {
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

      // המתן שכל האנימציות שאינן Spine יסתיימו
      await Promise.all(promises);
    }
  }

  private safelyStopSpineAnimation(spineObj: SpineGameObject): void {
    if (!this.isValidSpineObject(spineObj)) return;
    try {
      for (let i = 0; i < 10; i++) {
        spineObj.animationState.setEmptyAnimation(i, 0);
      }
    } catch (err) {
      console.warn("Error stopping Spine animation:", err);
    }
  }

  stopSequence(target: Phaser.GameObjects.GameObject): void {
    // עצירת אנימציות Spine
    if (this.isSpineObject(target)) {
      const spineObj = target as SpineGameObject;
      try {
        // נקה את כל ה-tracks
        for (let i = 0; i < 10; i++) {
          spineObj.animationState.setEmptyAnimation(i, 0);
        }
        this.activeSpineObjects.delete(spineObj);
      } catch (err) {
        console.warn("Error stopping Spine animation:", err);
      }
    }

    // עצירת אנימציות רגילות
    this.animationManager.stopAnimations(target);
  }

  pauseSequence(target: Phaser.GameObjects.GameObject): void {
    // השהיית אנימציות Spine
    if (this.isSpineObject(target)) {
      try {
        (target as SpineGameObject).animationState.timeScale = 0;
      } catch (err) {
        console.warn("Error pausing Spine animation:", err);
      }
    }

    // השהיית אנימציות רגילות
    this.animationManager.pauseAnimations(target);
  }

  resumeSequence(target: Phaser.GameObjects.GameObject): void {
    // המשך אנימציות Spine
    if (this.isSpineObject(target)) {
      try {
        (target as SpineGameObject).animationState.timeScale = 1;
      } catch (err) {
        console.warn("Error resuming Spine animation:", err);
      }
    }

    // המשך אנימציות רגילות
    this.animationManager.resumeAnimations(target);
  }

  private cancelAllDelayedCalls(): void {
    const delayedCallsToRemove = Array.from(this.activeDelayedCalls);
    for (const timerEvent of delayedCallsToRemove) {
      try {
        if (
          timerEvent &&
          timerEvent.getProgress &&
          timerEvent.getProgress() < 1
        ) {
          timerEvent.remove(false);
        }
      } catch (err) {
        console.warn("Error removing delayed call:", err);
      }
    }
    this.activeDelayedCalls.clear();
    try {
      if (this.scene && this.scene.time) {
        this.scene.time.removeAllEvents();
      }
    } catch (err) {
      console.warn("Error removing all time events:", err);
    }
  }

  stopAllSequences(): void {
    console.log("SequenceSystem: Stopping all sequences for all objects");

    // עצירת כל אנימציות ה-Spine
    this.activeSpineObjects.forEach((spineObj) => {
      try {
        for (let i = 0; i < 10; i++) {
          spineObj.animationState.setEmptyAnimation(i, 0);
        }
      } catch (err) {
        console.warn("Error stopping Spine animation:", err);
      }
    });
    this.activeSpineObjects.clear();

    // עצירת כל האנימציות הרגילות
    this.animationManager.stopAll();
  }

  /**
   * מנקה את כל הרצפים מהמערכת
   */
  clearAllSequences(): void {
    console.log("SequenceSystem: Clearing all sequences");
    this.stopAllSequences();
    this.activeSpineObjects.clear();
    this.spineTrackMap.clear();
    this.spineNextTrack = 0;
  }
}
