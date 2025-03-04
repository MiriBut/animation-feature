export type AnimationPropertyType =
  | "scale"
  | "position"
  | "rotation"
  | "opacity"
  | "color";

export interface AnimationConfig {
  property: AnimationPropertyType;
  startValue: any;
  endValue: any;
  duration: number;
  easing: string;
  delay?: number;
}

// הגדרת הטיפוסים הנתמכים
export type AnimatableGameObject =
  | Phaser.GameObjects.Sprite
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Video
  | Phaser.GameObjects.Container;

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
