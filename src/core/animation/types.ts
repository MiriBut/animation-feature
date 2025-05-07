import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";
import { AudioAnimation, ParticleEffectAnimation } from "./animations";

export type AnimationPropertyType =
  | "scale"
  | "position"
  | "rotation"
  | "opacity"
  | "color"
  | "spine"
  | "text"
  | "audio"
  | "visibility"
  | "particle"
  | "camera";

export interface AnimationConfig {
  property: AnimationPropertyType;
  startValue?: any;
  endValue?: any;
  duration: number;
  easing: string;
  delay?: number;
  animationName?: string;
  audioKey?: string;
  loop?: string;
  // for audio
  volume?: string;
  //for text
  textValue?: string;
  fontSize?: string | { startValue: number; endValue: number };

  color?: string | { startValue: string; endValue: string };
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;

  fontName?: string;
  assetName?: string;
  visible?: boolean;
}

// Interface for camera effect configuration
export interface CameraEffectConfig extends AnimationConfig {
  initialState?: {
    position?: { x: number; y: number; z: number };
    zoom?: number;
    opacity?: number;
  };
  timeline?: {
    onScreen?: Array<{ start: number; value: boolean }>;
    shake?: Array<{
      startTime: number;
      endTime: number;
      intensity: number;
      easeIn: string;
      easeOut: string;
    }>;
    flash?: Array<{
      startTime: number;
      endTime: number;
      color: string;
      easeIn: string;
      easeOut: string;
    }>;
    fade?: Array<{
      startTime: number;
      endTime: number;
      startOpacity: number;
      endOpacity: number;
      color: string;
      easeIn: string;
      easeOut: string;
    }>;
    zoom?: Array<{
      startTime: number;
      endTime: number;
      startValue: number;
      endValue: number;
      easeIn: string;
      easeOut: string;
    }>;
    blur?: Array<{
      startTime: number;
      endTime: number;
      startValue: number;
      endValue: number;
      easeIn: string;
      easeOut: string;
    }>;
    bloom?: Array<{
      startTime: number;
      endTime: number;
      startValue: number;
      endValue: number;
      easeIn: string;
      easeOut: string;
    }>;
    colorGrading?: Array<{
      startTime: number;
      endTime: number;
      startValue: number;
      endValue: number;
      easeIn: string;
      easeOut: string;
    }>;
    vignette?: Array<{
      startTime: number;
      endTime: number;
      startValue: number;
      endValue: number;
      easeIn: string;
      easeOut: string;
    }>;
  };
}

// Specific configuration for particle animations
export interface ParticleConfig extends AnimationConfig {
  emitZone: any;
  alpha?: { start: number; end: number };
  frequency?: number;
  gravityY?: number;
  rotate?: number | { min: number; max: number };
  tint?: number | number[] | { start: number | string; end: number | string };
  scale?: { start: number | { min: number; max: number }; end: number };
  angle?: { min: number; max: number };
  speed?: { min: number; max: number };
  property: "particle";
  texture?: string;
  quantity?: number;
  lifespan?: number | { min: number; max: number };
  blendMode?: Phaser.BlendModes | string;
  emitterConfig?: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig; // Add emitterConfig

  easing: string;
  duration: number;
  delay: number;
  color: string;
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
  | Phaser.Sound.WebAudioSound
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Particles.ParticleEmitter
  | Phaser.Cameras.Scene2D.Camera;

export interface IAnimatable {
  play(config: AnimationConfig | AudioConfig | ParticleConfig): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
}

export interface SequenceItem {
  type: AnimationPropertyType;
  config: AnimationConfig | AudioConfig | ParticleConfig;
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
