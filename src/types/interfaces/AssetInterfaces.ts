// src/types/interfaces/AssetInterfaces.ts
import { SpineGameObject } from "@esotericsoftware/spine-phaser";

export type AssetType =
  | "image"
  | "video"
  | "particle"
  | "spine"
  | "audio"
  | "text";

export interface AssetJson {
  elements: boolean;
  assets: AssetElement[];
}

export interface AssetDisplayProperties {
  visible: boolean;
  timelineScale: any;
  assetName: string;
  x?: number;
  y?: number;
  scale?: number; // Scale אחיד
  scaleX?: number; // Scale ספציפי ל-X
  scaleY?: number; // Scale ספציפי ל-Y
  alpha?: number;
  rotation?: number;
  tint?: number;
  anchor?: { x: number; y: number };
  pivot?: { x: number; y: number };
  ratio?: { width: number; height: number };
  emitterConfig?: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  volume?: number;
  loop?: boolean;
  play?: boolean;
  text?: string;
  fontSize?: string | number;
  color?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
}

export interface BaseAssetInfo {
  container?: Phaser.GameObjects.Container;
  type: AssetType;
  url: string;
  sprite?:
    | SpineGameObject
    | Phaser.GameObjects.GameObject
    | Phaser.Types.Sound.SoundConfig;
  pivot_override?: {
    x: number;
    y: number;
  };
  aspect_ratio_override?: {
    width: number;
    height: number;
  };
  scale_override?: { x: number; y: number }; // חדש: Scale Override
}

export interface SpineState {
  setAnimation: (
    trackIndex: number,
    animationName: string,
    loop: boolean
  ) => void;
}

export interface SpineState {
  setAnimation: (
    trackIndex: number,
    animationName: string,
    loop: boolean
  ) => void;
}

export interface SpineAssetInfo extends BaseAssetInfo {
  type: "spine";
  atlasUrl: string;
  skeletonUrl: string;
  skeletonType: "binary" | "json";
  sprite?: SpineGameObject | Phaser.GameObjects.GameObject;
}

export interface ImageAssetInfo extends BaseAssetInfo {
  type: "image";
  sprite?: Phaser.GameObjects.Sprite;
}

export interface VideoAssetInfo extends BaseAssetInfo {
  type: "video";
  sprite?: Phaser.GameObjects.Video;
}

export interface ParticleAssetInfo extends BaseAssetInfo {
  type: "particle";
  textureName?: string;
  sprite?: Phaser.GameObjects.Sprite;
}

export interface AudioAssetInfo extends BaseAssetInfo {
  type: "audio";
  url: string;
  sprite?: Phaser.Types.Sound.SoundConfig;
}
export interface TextAssetInfo extends BaseAssetInfo {
  fontFamily: string;
  isSystemFont?: boolean;
  type: "text";
  url: string;
  sprite?: Phaser.GameObjects.Text;
}
export interface AssetElement extends BaseAssetInfo {
  fontFamily: any;
  initialState: AssetDisplayProperties;
  assetName: string;
  assetUrl:
    | string
    | {
        atlasUrl: string;
        skeletonUrl: string;
        skeletonType?: "binary" | "json";
      };
  assetType: AssetType;
  scale_override?: { x: number; y: number };
  aspect_ratio_override?: { width: number; height: number };
}

export type AssetInfo =
  | BaseAssetInfo
  | ParticleAssetInfo
  | ImageAssetInfo
  | VideoAssetInfo
  | SpineAssetInfo
  | AudioAssetInfo;
