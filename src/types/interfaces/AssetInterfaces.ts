export interface AssetElement {
  assetName: string;
  assetUrl: string;
  assetType: string;
  scale_override?: {
    x: number;
    y: number;
  };
  aspect_ratio_override?: {
    width: number;
    height: number;
  };
  pivot_override?: {
    x: number;
    y: number;
  };
}

export interface AssetDisplayProperties {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation?: number;
  tint?: number;
  anchor?: { x: number; y: number };
  pivot?: { x: number; y: number };
  ratio?: { width: number; height: number };
}

export interface AssetInfo {
  url: string;
  type: string;
  sprite?: Phaser.GameObjects.Image;
}

export interface AssetJson {
  assets: AssetElement[];
}
export interface AssetsData {
  assets: AssetElement[];
}
