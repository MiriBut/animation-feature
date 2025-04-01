import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";
import { Scene } from "phaser";
import { AnimatableGameObject, AnimationConfig, IAnimatable } from "../types";

export class SpineAnimation implements IAnimatable {
  private scene: Scene;
  private target: SpineGameObject;
  private activeTracks: Set<number> = new Set(); // Tracks currently in use

  constructor(scene: Scene, target: AnimatableGameObject) {
    this.scene = scene;
    if (!(target instanceof SpineGameObject)) {
      throw new Error("SpineAnimation can only be used with SpineGameObject");
    }
    this.target = target as SpineGameObject;
  }

  async play(config: AnimationConfig): Promise<void> {
    return new Promise((resolve) => {
      const { animationName, duration } = config;

      if (!animationName || duration === undefined) {
        throw new Error("Spine animation requires animationName and duration");
      }

      const animationNames = this.target.skeleton.data.animations.map(
        (a) => a.name
      );
      console.log("Available animations:", animationNames);
      console.log("Active animation for spine: " + animationName);

      if (!animationNames.includes(animationName)) {
        console.warn(`Animation ${animationName} not found, skipping.`);
        resolve();
        return;
      }

      if (this.target.animationState) {
        const isLoop = config.loop === "true";

        // קביעת trackIndex לפי סוג האנימציה
        let trackIndex = 0;
        if (animationName.includes("arm") || animationName.includes("shoot")) {
          trackIndex = 1; // אנימציות של ידיים נפרדות מהריצה
        }

        // הפעלת האנימציה במסלול המתאים
        const trackEntry = this.target.animationState.setAnimation(
          trackIndex,
          animationName,
          isLoop
        );
        this.activeTracks.add(trackIndex); // סימון מסלול כפעיל

        // תזמון עצירת האנימציה אם היא לא בלולאה
        this.scene.time.delayedCall(duration, () => {
          if (!isLoop) {
            this.target.animationState.setEmptyAnimation(trackIndex, 0);
            this.activeTracks.delete(trackIndex); // שחרור המסלול
          }
          resolve();
        });
      } else {
        console.error("Spine animationState not available");
        resolve();
      }
    });
  }

  pause(): void {
    if (this.target.animationState) {
      this.target.animationState.timeScale = 0;
    }
  }

  resume(): void {
    if (this.target.animationState) {
      this.target.animationState.timeScale = 1;
    }
  }

  stop(): void {
    if (this.target.animationState) {
      // Stop all active tracks
      this.activeTracks.forEach((trackIndex) => {
        this.target.animationState.setEmptyAnimation(trackIndex, 0);
      });
      this.activeTracks.clear();
    }
  }

  reset(): void {
    this.stop();
  }
}
