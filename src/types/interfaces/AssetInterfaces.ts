// types/interfaces/AssetInterfaces.ts

// Basic shared types
export type AssetType = "image" | "video" | "particle";

export interface Point2D {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

// Asset Element Interface
export interface AssetElement {
  assetName: string;
  assetUrl: string;
  assetType: AssetType;
  scale_override?: Point2D;
  aspect_ratio_override?: Dimensions;
  pivot_override?: Point2D;
}

// Display Properties Interface
export interface AssetDisplayProperties {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation?: number;
  tint?: number;
  anchor?: Point2D;
  pivot?: Point2D;
  ratio?: Dimensions;
}

// Asset Info Interfaces
export interface BaseAssetInfo {
  url: string;
  type: AssetType;
}

export interface ImageAssetInfo extends BaseAssetInfo {
  type: "image";
  sprite?: Phaser.GameObjects.Image;
}

export interface ParticleAssetInfo extends BaseAssetInfo {
  type: "particle";
  textureName: string;
  sprite?: Phaser.GameObjects.Sprite;
  emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export interface ImageAssetInfo extends BaseAssetInfo {
  type: "image";
  sprite?: Phaser.GameObjects.Image;
}

export interface VideoAssetInfo extends BaseAssetInfo {
  type: "video";
  sprite?: Phaser.GameObjects.Video;
}

export interface ParticleAssetInfo extends BaseAssetInfo {
  type: "particle";
  textureName: string;
  sprite?: Phaser.GameObjects.Sprite;
  emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export type AssetInfo = ImageAssetInfo | ParticleAssetInfo | VideoAssetInfo;

// Asset JSON interface (removing duplicate AssetsData)
export interface AssetJson {
  assets: AssetElement[];
}
