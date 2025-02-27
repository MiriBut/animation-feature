// src/types/spine.d.ts
declare module "@esotericsoftware/spine-phaser" {
  import { Skeleton, AnimationState } from "@esotericsoftware/spine-core";

  export class SpineGameObject extends Phaser.GameObjects.GameObject {
    animationState: AnimationState;
    setRotation(rotation: number) {
      throw new Error("Method not implemented.");
    }
    setPosition(x: number, y: number) {
      throw new Error("Method not implemented.");
    }
    skeleton: Skeleton;
    state: AnimationState;

    setAnimation(trackIndex: number, animationName: string, loop: boolean): any;
    addAnimation(
      trackIndex: number,
      animationName: string,
      loop: boolean,
      delay: number
    ): any;

    // משתנים פנימיים של spine-phaser
    scaleX: number;
    scaleY: number;

    // הוסף את המתודות שאתה משתמש בהן

    destroy(fromScene?: boolean): void;
    setOrigin(x?: number, y?: number): this;
    setAlpha(value?: number): this;
    setVisible(value: boolean): this;
    setScale(x: number, y?: number): this;
  }
}
