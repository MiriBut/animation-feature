import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";
import { Scene } from "phaser";
import { AnimatableGameObject, AnimationConfig, IAnimatable } from "../types";

export class SpineAnimation implements IAnimatable {
  private scene: Scene;
  private target: SpineGameObject;

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
      //console.log("Available animations:", animationNames);
      console.log("acive animation for spine" + animationName);

      if (!animationNames.includes(animationName)) {
        console.warn(`Animation ${animationName} not found, skipping.`);
        resolve();
        return;
      }

      if (this.target.animationState) {
        const isLoop = config.loop == "true" ? true : false;
        this.target.animationState.setAnimation(0, animationName, isLoop);

        this.scene.time.delayedCall(duration, () => {
          this.target.animationState.setEmptyAnimation(0, 0);
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
      this.target.animationState.setEmptyAnimation(0, 0);
    }
  }

  reset(): void {
    this.stop();
  }
}
