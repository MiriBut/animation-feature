export interface TimelineElement {
  pivot: any;
  elementName: string;
  assetType: "image" | "video" | "text";
  assetName: string;
  initialState?: {
    position?: { x: number; y: number; z?: number };
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
  "template video json": TimelineElement[];
}

export interface MessageModalProps {
  isOpen: boolean;
  type: "error" | "success";
  title: string;
  messages: string[];
  autoClose?: boolean;
}
