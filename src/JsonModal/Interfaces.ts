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

export interface TimelineElement {
  elementName: string;
  assetType: string;
  assetName: string;
  initialState?: {
    position?: { x: number; y: number; z: number };
    scale?: { x: number; y: number };
    opacity?: number;
    color?: string;
    rotation?: number;
  };
  timeline?: {
    scale?: TimelineAnimation[];
    position?: TimelineAnimation[];
    color?: TimelineAnimation[];
    opacity?: TimelineAnimation[];
    rotation?: TimelineAnimation[];
  };
}

export interface TimelineAnimation {
  startTime: number;
  endTime: number;
  startValue: any;
  endValue: any;
  easeIn: string;
  easeOut: string;
}

export interface TimelineJson {
  "template video json": Array<{
    elementName: string;
    assetType: "image" | "video" | "text";
    assetName: string;
    initialState: {
      position?: {
        x: number;
        y: number;
        z?: number;
      };
      scale?: {
        x: number;
        y: number;
      };
      opacity?: number;
      color?: string;
      rotation?: number;
    };
    timeline?: {
      scale?: Array<{
        startTime: number;
        endTime: number;
        startValue: { x: number; y: number };
        endValue: { x: number; y: number };
        easeIn: string;
        easeOut: string;
      }>;
      position?: Array<any>;
      color?: Array<any>;
      opacity?: Array<any>;
      rotation?: Array<any>;
    };
  }>;
}

export interface MessageModalProps {
  isOpen: boolean;
  type: "error" | "success";
  title: string;
  messages: string[];
  autoClose?: boolean;
}
