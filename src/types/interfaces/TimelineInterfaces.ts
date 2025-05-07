export interface TimelineElement {
  camera: any;
  assetUrl: string;
  elementName: string;
  assetType:
    | "image"
    | "video"
    | "text"
    | "particle"
    | "spine"
    | "audio"
    | "camera";
  assetName: string;
  particles?: {
    textureName: string;
    config: ParticleConfig;
  };
  initialState?: {
    zoom: number | undefined;
    ParticleEmitterConfig: ParticleConfig | undefined;
    emitterConfig: ParticleConfig;
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
    particle?: ParticleConfig;
    particleScale?: { min: number; max: number };
    particleSpeed?: { min: number; max: number };
    frequency?: number;
    anchor?: { x: number; y: number };
    audio: string;
    volume?: number;
    loop?: boolean | undefined;
  };
  onScreen?: { time: number; value: boolean }[]; // Kept as is
  timeline?: {
    zoom?: any;
    fade?: any;
    flash?: any;
    shake?: any;
    blur?: any;
    bloom?: any;
    colorGrading?: any;
    vignette?: any;

    text: any;
    animation?: TimelineAnimation[];
    scale?: TimelineAnimation[];
    position?: TimelineAnimation[];
    color?: TimelineAnimation[];
    opacity?: TimelineAnimation[];
    rotation?: TimelineAnimation[];
    emitterScale?: TimelineAnimation[];
    particleScale?: TimelineAnimation[];
    particleSpeed?: TimelineAnimation[];
    particle?: TimelineAnimation[];
    frequency?: TimelineAnimation[];
    loop?: TimelineAnimation[];
    audio?: TimelineAnimation[];
    volume: TimelineAnimation[];
    play: TimelineAnimation[];
    onScreen?: TimelineAnimation[];
    camera?: TimelineAnimation[];
  };
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
  emitZone: any;
  start: any;
  texture: any;
  quantity: any;
  lifespan: any;
  speed: any;
  angle: any;
  scale: any;
  alpha: any;
  blendMode: any;
  color: any;
  tint: any;
  gravityY: any;
  rotate: any;
  emitterConfig: any;
  time: number;
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
