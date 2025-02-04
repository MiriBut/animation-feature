import { Scene } from "phaser";
import { BackgroundManager } from "../managers/BackgroundManager";
import { SceneUI } from "../ui/SceneUI";
import { AudioManager } from "../managers/AudioManager";
import { CharacterManager } from "../managers/CharacterManager";
import { JsonManager } from "../managers/JsonManager";
import { VideoEngine } from "../managers/VideoEngine"; 
import { ExportManager } from "../managers/ExportManager";
import { AssetService } from "../core/services/AssetService";

interface AssetJson {
  assets: Array<{
    assetName: string;
    assetUrl: string;
    assetType: string;
    scale_override: {
      x: number;
      y: number;
    };
    aspect_ratio_override: {
      width: number;
      height: number;
    };
    pivot_override: {
      x: number;
      y: number;
    };
  }>;
}

// נעדכן את הממשק של TimelineJson כך שיתאים למבנה החדש
interface TimelineJson {
  "template video json": Array<{
    elementName: string;
    assetType: string;
    assetName: string;
    initialState: {
      position?: {
        x: number;
        y: number;
        z: number;
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

export class AnimationScene extends Scene {
  private ui?: SceneUI;
  private isResizing: boolean = false;
  private currentBackground: File | null = null;

  private backgroundManager!: BackgroundManager;
  private characterManager!: CharacterManager;
  private audioManager!: AudioManager;
  private jsonManager!: JsonManager;
  private exportManager!: ExportManager;
  private videoEngine!: VideoEngine;
  private assetService!: AssetService;

  private readonly DEFAULT_WIDTH = 1920;
  private readonly DEFAULT_HEIGHT = 1080;

  constructor() {
    super({ key: "AnimationScene" });
  }

  init(): void {
    console.log("Scene initialization started");

    if (!this.backgroundManager) {
      this.backgroundManager = new BackgroundManager(this);
      this.characterManager = new CharacterManager(this);
      this.audioManager = new AudioManager(this);
      this.exportManager = new ExportManager(this, this.audioManager);
      this.assetService = new AssetService(this); // the order is importent, must be started before video engine
      this.jsonManager = new JsonManager(this, this.assetService); // העבר את ה-assetService
      this.videoEngine = new VideoEngine(this, this.assetService); // העבר את ה-assetService
    }

    this.stopAndRemoveScene("default");
    this.stopAndRemoveScene("bootScene");
  }

  preload(): void {
    this.backgroundManager.preload();
    this.characterManager.preload();
    this.audioManager.preload();

    this.characterManager.loadSpineAsset({
      key: "spineboy",
      skeletonURL: "assets/skelSpineBoy/spineboy-pro.skel",
      atlasURL: "assets/skelSpineBoy/spineboy-pma.atlas",
      type: "binary",
    });
  }

  async create(): Promise<void> {
    console.log("AnimationScene create started");
    this.initializeScene();

    //this.backgroundManager.create();
    //this.characterManager.create();
    //this.audioManager.create();

    if (this.currentBackground && this.isResizing) {
      await this.reloadBackground();
    }

    if (!this.ui) {
      this.ui = new SceneUI(
        this.updateResolution.bind(this),
        this.handleBackgroundChange.bind(this),
        this.handleMusicChange.bind(this),
        this.handleCharacterChange.bind(this),
        this.startRecording.bind(this),
        this.stopRecording.bind(this),
        this.onAssetsJson.bind(this),
        this.onTimelineJson.bind(this)
      );
    }

    this.isResizing = false;
  }

  private initializeScene(): void {
    if (!this.isResizing) {
      this.scale.setGameSize(this.DEFAULT_WIDTH, this.DEFAULT_HEIGHT);
    }

    this.scale.scaleMode = Phaser.Scale.FIT;
    this.scale.autoCenter = Phaser.Scale.CENTER_BOTH;

    if (!this.scale.listeners("resize").length) {
      this.scale.on("resize", this.handleResize, this);
    }

    const canvas = this.game.canvas;
    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "0",
    });
  }

  private async reloadBackground(): Promise<void> {
    if (this.currentBackground) {
      await new Promise<void>((resolve) => {
        this.cameras.main.fadeOut(
          300,
          0,
          0,
          0,
          (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) resolve();
          }
        );
      });

      await this.backgroundManager.changeBackground(this.currentBackground);

      this.cameras.main.fadeIn(300, 0, 0, 0);
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (this.isResizing) return;

    const { width, height } = gameSize;

    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBounds(0, 0, width, height);
  }

  private async updateResolution(width: number, height: number): Promise<void> {
    if (this.isResizing) return;

    console.log("Updating resolution:", width, height);
    this.isResizing = true;

    await new Promise<void>((resolve) => {
      this.cameras.main.fadeOut(
        10,
        0,
        0,
        0,
        (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress === 1) resolve();
        }
      );
    });

    this.scale.setGameSize(width, height);
    this.exportManager.changeResolution(width, height).catch((error) => {
      console.error("Failed to change resolution:", error);
    });
    this.cameras.main.setBounds(0, 0, width, height);
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.scene.restart();
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.isResizing = false;
  }

  private async handleCharacterChange(
    skelFile: File,
    atlasFile: File,
    pngFiles: File[]
  ): Promise<void> {
    try {
      await this.characterManager.changeCharacter(
        skelFile,
        atlasFile,
        pngFiles
      );
    } catch (error) {
      console.error("Error changing character:", error);
      alert("Failed to change character. Please try again.");
    }
  }

  private async handleBackgroundChange(file: File): Promise<void> {
    try {
      this.currentBackground = file;
      await this.backgroundManager.changeBackground(file);
    } catch (error) {
      console.error("Error changing background:", error);
      this.currentBackground = null;
    }
  }

  private async handleMusicChange(file: File): Promise<void> {
    try {
      await this.audioManager.changeMusic(file);
    } catch (error) {
      console.error("Error changing music:", error);
      alert("Failed to change music. Please try again.");
    }
  }

  private async onAssetsJson(file: File): Promise<void> {
    try {
      console.log("Starting to load assets JSON");
      await this.jsonManager.handleAssetsJson(file);
      console.log("Assets loaded successfully");
      // הדפס את מצב הנכסים אחרי הטעינה
      this.assetService.debugAssetsState();
    } catch (error) {
      console.error("Error loading assets:", error);
      // אופציונלי: הצג הודעת שגיאה למשתמש
      throw error;
    }
  }

  private async onTimelineJson(file: File): Promise<void> {
    try {
      console.log("Starting to load timeline JSON");
      // בדוק שיש נכסים טעונים
      const assetsMap = this.assetService.getAssetsMap();
      console.log("Current assets:", Array.from(assetsMap.keys()));

      if (assetsMap.size === 0) {
        throw new Error("No assets loaded. Please load assets JSON first.");
      }

      await this.jsonManager.handleTimelineJson(file);
      const timelineData = await this.jsonManager.parseTimelineJson(file);

      if (!timelineData) {
        throw new Error("Failed to parse timeline JSON");
      }

      await this.videoEngine.loadTimeline(timelineData);
      await this.videoEngine.animate();
    } catch (error) {
      console.error("Error processing timeline JSON:", error);
      // הצג הודעת שגיאה למשתמש
      throw error;
    }
  }

  private async startRecording(): Promise<void> {
    try {
      await this.exportManager.startRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      this.exportManager.stopRecording();
    } catch (error) {
      console.error("Error stopping recording:", error);
      throw error;
    }
  }

  private stopAndRemoveScene(sceneKey: string): void {
    const scene = this.game.scene.getScene(sceneKey);
    if (scene) {
      scene.scene.stop();
      scene.scene.remove();
    }
  }

  private stopAndRemoveAllScenesExceptCurrent(): void {
    this.game.scene.scenes.forEach((scene) => {
      if (scene !== this) {
        this.stopAndRemoveScene(scene.scene.key);
      }
    });
  }

  destroy(): void {
    this.ui?.destroy();
    this.characterManager.destroy();
    this.audioManager.destroy();
    this.exportManager.destroy();
    this.scale.removeListener("resize", this.handleResize, this);
  }
}
