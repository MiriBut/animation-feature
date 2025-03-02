// src/types/interfaces/AssetInterfaces.ts
import { SpineGameObject } from "@esotericsoftware/spine-phaser";

export type AssetType = "image" | "video" | "particle" | "spine";

export interface AssetElement {
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
  pivot_override?: { x: number; y: number };
}

export interface AssetJson {
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
}

export interface BaseAssetInfo {
  container?: Phaser.GameObjects.Container;
  type: AssetType;
  url: string;
  sprite?: SpineGameObject | Phaser.GameObjects.GameObject;
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

export type AssetInfo =
  | BaseAssetInfo
  | ParticleAssetInfo
  | ImageAssetInfo
  | VideoAssetInfo
  | SpineAssetInfo;
