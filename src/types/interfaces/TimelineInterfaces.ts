export interface TimelineElement {
  assetUrl: string;
  elementName: string;
  assetType: "image" | "video" | "text" | "particle" | "spine" | "audio";
  assetName: string;
  particles?: {
    textureName: string; // שם הטקסטורה לפרטיקל
    config: ParticleConfig;
  };
  initialState?: {
    textDecoration: undefined;
    fontStyle: undefined;
    fontWeight: string;
    fontSize: boolean;
    text: undefined;
    animation: string;
    position?: { x: number; y: number; z?: number };
    scale?: { x: number; y: number };
    opacity?: number;
    color?: string;
    rotation?: number;

    emitterScale?: number;
    particleScale?: { min: number; max: number };
    particleSpeed?: { min: number; max: number };
    frequency?: number;

    anchor?: { x: number; y: number }; // Values between 0 and 1
    // for sounds
    audio: string;
    volume?: number;
    loop?: boolean | undefined;
  };
  timeline?: {
    text: any;
    animation?: TimelineAnimation[];
    scale?: TimelineAnimation[];
    position?: TimelineAnimation[];
    color?: TimelineAnimation[];
    opacity?: TimelineAnimation[];
    rotation?: TimelineAnimation[];
    // for particles
    emitterScale?: TimelineAnimation[];
    particleScale?: TimelineAnimation[];
    particleSpeed?: TimelineAnimation[];
    frequency?: TimelineAnimation[];
    // for audio
    loop?: TimelineAnimation[];
    audio?: TimelineAnimation[];
    volume: TimelineAnimation[];
    play: TimelineAnimation[];
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
  tint?: string[];
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
  stopOnComplete: boolean;
  detune: number;
  rate: number;
  markers: null;
  fadeOut: number;
  fadeIn: number;
  audioKey: any;
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
