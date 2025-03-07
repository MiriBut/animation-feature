export interface TimelineElement {
  assetUrl: string;
  elementName: string;
  assetType: "image" | "video" | "text" | "particle" | "spine";
  assetName: string;
  particles?: {
    textureName: string; // שם הטקסטורה לפרטיקל
    config: ParticleConfig;
  };
  initialState?: {
    animation: string;
    position?: { x: number; y: number; z?: number };
    scale?: { x: number; y: number };
    opacity?: number;
    color?: string;
    rotation?: number;
    // הוספת הגדרות ספציפיות לפרטיקלס במצב ההתחלתי
    emitterScale?: number;
    particleScale?: { min: number; max: number };
    particleSpeed?: { min: number; max: number };
    frequency?: number;
  };
  timeline?: {
    animation?: TimelineAnimation[];
    scale?: TimelineAnimation[];
    position?: TimelineAnimation[];
    color?: TimelineAnimation[];
    opacity?: TimelineAnimation[];
    rotation?: TimelineAnimation[];
    // הוספת אנימציות ספציפיות לפרטיקלס
    emitterScale?: TimelineAnimation[];
    particleScale?: TimelineAnimation[];
    particleSpeed?: TimelineAnimation[];
    frequency?: TimelineAnimation[];
    loop?: TimelineAnimation[];
  };
  onScreen?: {
    startTime: number;
    endTime: number;
  }[];
}

interface ParticleConfig {
  frequency?: number;
  lifespan?: {
    min: number;
    max: number;
  };
  quantity?: number;
  speed?: {
    min: number;
    max: number;
  };
  scale?: {
    start: number;
    end: number;
  };
  alpha?: {
    start: number;
    end: number;
  };
  rotate?: {
    min: number;
    max: number;
  };
  tint?: string[]; // צבעים בפורמט "0xFFFFFF"
  blendMode?: number;
  gravityX?: number;
  gravityY?: number;
  emitZone?: {
    type: "edge" | "random";
    source: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export interface TimelineAnimation {
  value: any;
  duration: number;
  startTime: number;
  endTime: number;
  startValue: any;
  endValue: any;
  easeIn: string;
  easeOut: string;
  //for spine only
  animationName: string;
  loop: string;
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
