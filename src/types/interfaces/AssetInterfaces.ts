export interface Asset {
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

export interface AssetInfo {
  url: string;
  type: string;
  sprite?: Phaser.GameObjects.Image;
}

export interface AssetJson {
  assets: Asset[];
}
