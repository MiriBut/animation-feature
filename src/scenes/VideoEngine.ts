import { Scene } from "phaser";
import { AssetService } from "../JsonModal/AssetService";

export interface TimelineJson {
  "template video json": TimelineElement[];
}

export interface TimelineElement {
  elementName: string;
  assetType: "image" | "video" | "text";
  assetName: string;
  initialState?: {
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    opacity?: number;
  };
  timeline?: {
    position?: AnimationDefinition[];
    scale?: AnimationDefinition[];
    opacity?: AnimationDefinition[];
    rotation?: AnimationDefinition[];
  };
}

export interface AnimationDefinition {
  startTime: number;
  endTime: number;
  startValue: any;
  endValue: any;
  easeIn?: string;
  easeOut?: string;
}

export class VideoEngine {
  private scene: Scene;
  private assetService: AssetService;
  private timelineData: TimelineJson | null = null;
  private frameCount: number = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private fps: number = 30;
  private depth: number = 1;

  constructor(scene: Scene, assetService: AssetService) {
    this.scene = scene;
    this.assetService = assetService;
    this.setupScene();
  }

  private setupScene(): void {
    this.scene.cameras.main.setBackgroundColor("#ffffff");
    this.scene.scale.setGameSize(1920, 1080);
  }

  public async loadTimeline(timeline: TimelineJson): Promise<void> {
    this.timelineData = timeline;
    await this.initializeElements();
  }

  private async initializeElements(): Promise<void> {
    if (!this.timelineData) return;

    for (const element of this.timelineData["template video json"]) {
      if (element.initialState) {
        const initialProperties = {
          x: element.initialState.position?.x ?? 0,
          y: element.initialState.position?.y ?? 0,
          scale: element.initialState.scale?.x ?? 1,
          alpha: element.initialState.opacity ?? 1,
        };

        try {
          this.assetService.displayAsset(
            element.elementName,
            initialProperties
          );
          console.log(`${element.elementName} initialized successfully`);
        } catch (error) {
          console.error(`Failed to initialize ${element.elementName}:`, error);
        }
      }
    }
  }

  public async animate(): Promise<void> {
    if (!this.timelineData) return;

    const maxDuration = this.getMaxDuration();
    let currentTime = 0;

    while (currentTime <= maxDuration) {
      for (const element of this.timelineData["template video json"]) {
        await this.updateElement(element, currentTime);
      }

      currentTime += 1000 / this.fps;
      this.frameCount++;

      await new Promise((resolve) => setTimeout(resolve, 1000 / this.fps));
    }
  }

  private async updateElement(
    element: TimelineElement,
    currentTime: number
  ): Promise<void> {
    if (!element.timeline) return;

    const properties: any = {};

    // Update position
    if (element.timeline.position) {
      for (const anim of element.timeline.position) {
        if (currentTime >= anim.startTime && currentTime <= anim.endTime) {
          const progress =
            (currentTime - anim.startTime) / (anim.endTime - anim.startTime);
          properties.x = this.interpolate(
            anim.startValue.x,
            anim.endValue.x,
            progress,
            anim.easeIn || "linear"
          );
          properties.y = this.interpolate(
            anim.startValue.y,
            anim.endValue.y,
            progress,
            anim.easeOut || "linear"
          );
        }
      }
    }

    // Update scale
    if (element.timeline.scale) {
      for (const anim of element.timeline.scale) {
        if (currentTime >= anim.startTime && currentTime <= anim.endTime) {
          const progress =
            (currentTime - anim.startTime) / (anim.endTime - anim.startTime);
          properties.scale = {
            x: this.interpolate(
              anim.startValue.x,
              anim.endValue.x,
              progress,
              anim.easeIn || "linear"
            ),
            y: this.interpolate(
              anim.startValue.y,
              anim.endValue.y,
              progress,
              anim.easeOut || "linear"
            ),
          };
        }
      }
    }

    // Update opacity
    if (element.timeline.opacity) {
      for (const anim of element.timeline.opacity) {
        if (currentTime >= anim.startTime && currentTime <= anim.endTime) {
          const progress =
            (currentTime - anim.startTime) / (anim.endTime - anim.startTime);
          properties.alpha = this.interpolate(
            anim.startValue,
            anim.endValue,
            progress,
            anim.easeIn || "linear"
          );
        }
      }
    }

    // Update rotation
    if (element.timeline.rotation) {
      for (const anim of element.timeline.rotation) {
        if (currentTime >= anim.startTime && currentTime <= anim.endTime) {
          const progress =
            (currentTime - anim.startTime) / (anim.endTime - anim.startTime);
          properties.rotation = this.interpolate(
            anim.startValue,
            anim.endValue,
            progress,
            anim.easeIn || "linear"
          );
        }
      }
    }

    // Update the game object if any properties changed
    if (Object.keys(properties).length > 0) {
      try {
        this.assetService.updateAssetProperties(
          element.elementName,
          properties
        );
      } catch (error) {
        console.error(`Failed to update ${element.elementName}:`, error);
      }
    }
  }

  private interpolate(
    start: number,
    end: number,
    progress: number,
    easing: string
  ): number {
    const easingFunction = this.getEasingFunction(easing);
    return start + (end - start) * easingFunction(progress);
  }

  private getEasingFunction(easing: string): (t: number) => number {
    switch (easing.toLowerCase()) {
      case "linear":
        return (t) => t;
      case "easein":
        return (t) => t * t;
      case "easeout":
        return (t) => 1 - (1 - t) * (1 - t);
      case "easeinout":
        return (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      default:
        return (t) => t;
    }
  }

  private getMaxDuration(): number {
    if (!this.timelineData) return 0;

    return Math.max(
      ...this.timelineData["template video json"].map((element) => {
        if (!element.timeline) return 0;

        const durations = Object.values(element.timeline)
          .flat()
          .map((anim: AnimationDefinition) => anim.endTime);

        return Math.max(0, ...durations);
      })
    );
  }

  public cleanup(): void {
    this.timelineData = null;
    this.frameCount = 0;
    this.assetService.hideAllAssets();
  }
}
