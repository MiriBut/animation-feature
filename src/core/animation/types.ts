import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";

export type AnimationPropertyType =
  | "scale"
  | "position"
  | "rotation"
  | "opacity"
  | "color"
  | "spine";

export interface AnimationConfig {
  property: AnimationPropertyType;
  startValue: any;
  endValue: any;
  duration: number;
  easing: string;
  delay?: number;
  animationName?: string;
  loop?: string;
}

// הגדרת הטיפוסים הנתמכים
export type AnimatableGameObject =
  | Phaser.GameObjects.Sprite
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Video
  | Phaser.GameObjects.Container
  | SpineGameObject;

export interface IAnimatable {
  play(config: AnimationConfig): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
}
export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig;
  delay?: number;
}

export interface SyncGroup {
  target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Video;
  sequence: SequenceItem[];
}
