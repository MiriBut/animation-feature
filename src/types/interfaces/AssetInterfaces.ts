// src/types/interfaces/AssetInterfaces.ts
import { SpineGameObject } from "@esotericsoftware/spine-phaser";

export type AssetType = "image" | "video" | "particle" | "spine" | "audio";

export interface AssetJson {
  elements: boolean;
  assets: AssetElement[];
}

export interface AssetDisplayProperties {
  x?: number;
  y?: number;
  scale?: number;
  alpha?: number;
  rotation?: number;
  tint?: number;
  anchor?: { x: number; y: number };
  pivot?: { x: number; y: number };
  ratio?: { width: number; height: number };
  emitterConfig?: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

  //for audios
  volume?: number;
  loop?: boolean;
  play?: boolean; //for imiiate play (is needed?)
}

export interface BaseAssetInfo {
  container?: Phaser.GameObjects.Container;
  type: AssetType;
  url: string;
  sprite?:
    | SpineGameObject
    | Phaser.GameObjects.GameObject
    | Phaser.Types.Sound.SoundConfig;
  pivot_override?: { x: number; y: number };
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
export interface AssetElement extends BaseAssetInfo {
  initialState: any;
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
