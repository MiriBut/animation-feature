import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";
import { AudioAnimation } from "./animations";

export type AnimationPropertyType =
  | "scale"
  | "position"
  | "rotation"
  | "opacity"
  | "color"
  | "spine"
  | "audio";

export interface AnimationConfig {
  property: AnimationPropertyType;
  startValue: any;
  endValue: any;
  duration: number;
  easing: string;
  delay?: number;
  animationName?: string;
  audioKey?: string;
  loop?: string; // נשאר string כדי להתאים ל-SyncSystem
  volume?: string;
}

export interface AudioConfig {
  property: "audio";
  startValue: any;
  endValue: any;
  duration: number;
  easing: string;
  delay?: number;
  audioKey: string;
  loop?: boolean | string | undefined;
  volume:
    | number
    | {
        startValue: number;
        endValue: number;
      };
  fadeIn?: number;
  fadeOut?: number;
  markers?: AudioMarker[];
  markerToPlay?: string;
  rate?: number;
  detune?: number;
  stopOnComplete?: boolean;
}

export interface AudioMarker {
  name: string;
  start: number;
  duration: number;
  config?: any;
}

export type AnimatableGameObject =
  | Phaser.GameObjects.Sprite
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Video
  | Phaser.GameObjects.Container
  | SpineGameObject
  | Phaser.Sound.WebAudioSound; // שינוי מ-AudioAnimation ל-WebAudioSound ישיר

export interface IAnimatable {
  play(config: AnimationConfig | AudioConfig): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
}

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig;
  delay?: number;
}

export interface SyncGroup {
  target:
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Particles.ParticleEmitter
    | Phaser.Sound.WebAudioSound
    | Phaser.GameObjects.Container;
  sequence: SequenceItem[];
}
