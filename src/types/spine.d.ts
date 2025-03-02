// // src/types/spine.d.ts
// declare module "@esotericsoftware/spine-phaser" {
//   import { Skeleton, AnimationState } from "@esotericsoftware/spine-core";

//   // הרחבת ה-SpineGameObject הקיים במקום הגדרה מחדש
//   interface SpineGameObject {
//     animationState: AnimationState;
//     skeleton: Skeleton;

//     // מתודות של AnimationState ישירות על האובייקט (אם את רוצה תמיכה ישירה)
//     setAnimation(
//       trackIndex: number,
//       animationName: string,
//       loop: boolean
//     ): void;
//     addAnimation(
//       trackIndex: number,
//       animationName: string,
//       loop: boolean,
//       delay?: number
//     ): void;

//     // מתודות נוספות של Phaser GameObject
//     setOrigin(x?: number, y?: number): this;
//     setAlpha(value?: number): this;
//     setVisible(value: boolean): this;
//     setScale(x: number, y?: number): this;
//     setPosition(x: number, y: number): this;
//     setRotation(rotation: number): this;

//     // מאפיינים נוספים
//     scaleX: number;
//     scaleY: number;
//   }
// }
