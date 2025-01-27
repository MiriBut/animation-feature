import { Scene } from "phaser";
import { BackgroundManager } from "../managers/BackgroundManager";
import { SceneUI } from "../ui/SceneUI";
import { AudioManager } from "../managers/AudioManager";
import { CharacterManager } from "../managers/CharacterManager";
import { ExportManager } from "../managers/ExportManager";

export class AnimationScene extends Scene {
  private ui?: SceneUI;
  private isResizing: boolean = false;
  private currentBackground: File | null = null;

  private backgroundManager!: BackgroundManager;
  private characterManager!: CharacterManager;
  private audioManager!: AudioManager;
  private exportManager!: ExportManager;

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

    this.backgroundManager.create();
    this.characterManager.create();
    this.audioManager.create();

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
        this.stopRecording.bind(this)
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
