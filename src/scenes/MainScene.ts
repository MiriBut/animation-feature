import { Scene } from "phaser";
import { BackgroundManager } from "../managers/BackgroundManager";
import { AudioManager } from "../managers/AudioManager";
//import { CharacterManager } from "../managers/CharacterManager";
import { ExportManager } from "../managers/ExportManager";
import { AssetService } from "../core/services/AssetService";
import { VideoService } from "../core/services/VideoService";
import { SceneUI } from "../ui/SceneUI";
import { SyncSystem } from "../core/animation/SyncSystem";
import { showMessage, createErrorMessage } from "../ui/ErrorModal/MessageModal";
import "../core/animation/animations";

export class MainScene extends Scene {
  private ui?: SceneUI;
  private isResizing: boolean = false;
  private currentBackground: File | null = null;

  // Services
  private assetService!: AssetService;
  private videoService!: VideoService;
  private syncSystem!: SyncSystem;

  // Managers
  private backgroundManager!: BackgroundManager;
  //private characterManager!: CharacterManager;
  private audioManager!: AudioManager;
  private exportManager!: ExportManager;

  private readonly DEFAULT_WIDTH = 1920;
  private readonly DEFAULT_HEIGHT = 1080;

  constructor() {
    console.log("10.0.25 version 0.0");
    super({ key: "MainScene" });
  }

  init(): void {
    console.log("Scene initialization started");

    // Initialize services first
    this.assetService = new AssetService(this);
    this.videoService = new VideoService(this, this.assetService);
    this.syncSystem = new SyncSystem(this);

    // Initialize managers
    this.backgroundManager = new BackgroundManager(this);
    //this.characterManager = new CharacterManager(this);
    this.audioManager = new AudioManager(this);
    this.exportManager = new ExportManager(this, this.audioManager);

    this.stopAndRemoveScene("default");
    this.stopAndRemoveScene("bootScene");
  }

  preload(): void {}

  async create(): Promise<void> {
    console.log(
      "MainScene create started with dimensions:",
      this.scale.width,
      this.scale.height
    );
    this.initializeScene();

    this.audioManager = new AudioManager(this);

    // Make sure background reloads if we're resizing
    if (this.currentBackground) {
      await this.reloadBackground();
    }

    if (!this.ui) {
      this.ui = new SceneUI(
        this.updateResolution.bind(this),
        // this.handleBackgroundChange.bind(this),
        // this.handleCharacterChange.bind(this),
        this.startRecording.bind(this),
        this.stopRecording.bind(this),
        this.handleAssetsJson.bind(this),
        this.handleTimelineJson.bind(this),
        this.assetService
      );
    }

    // Ensure camera is properly configured
    this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
    console.log("MainScene create completed");
  }

  private initializeScene(): void {
    if (!this.isResizing) {
      console.log("setGameSize");
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

  private async updateResolution(width: number, height: number): Promise<void> {
    if (this.isResizing) {
      console.log("Already resizing, ignoring request");
      return;
    }

    console.log("Updating resolution:", width, height);
    this.isResizing = true;

    try {
      // Fade out camera
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

      // Get old dimensions from current scene size
      const oldWidth = this.scale.width;
      const oldHeight = this.scale.height;

      // Set new game size
      this.scale.setGameSize(width, height);

      // Update asset positions
      this.assetService.handleResize(oldWidth, oldHeight, width, height);

      // Update export manager resolution
      await this.exportManager.changeResolution(width, height);

      // Update camera bounds
      this.cameras.main.setBounds(0, 0, width, height);

      // Wait a bit longer to ensure changes are applied
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Instead of using scene.restart(), try manually reinitializing the scene
      this.initializeScene();

      if (this.currentBackground) {
        await this.reloadBackground();
      }

      // Fade back in
      this.cameras.main.fadeIn(300, 0, 0, 0);

      // Wait for fade in to complete
      await new Promise<void>((resolve) => {
        this.cameras.main.once("camerafadeincomplete", () => {
          resolve();
        });
      });

      console.log("Resolution update completed successfully");
    } catch (error) {
      console.error("Error updating resolution:", error);
      showMessage({
        isOpen: true,
        title: "Resolution Error",
        messages: [createErrorMessage("Failed to update resolution")],
      });
    } finally {
      this.isResizing = false;
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (this.isResizing) return;

    const { width, height } = gameSize;
    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBounds(0, 0, width, height);
  }

  private async reloadBackground(): Promise<void> {
    if (!this.currentBackground) return;

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

  private async handleBackgroundChange(file: File): Promise<void> {
    try {
      this.currentBackground = file;
      await this.backgroundManager.changeBackground(file);
    } catch (error) {
      console.error("Error changing background:", error);
      this.currentBackground = null;
      showMessage({
        isOpen: true,
        title: "Background Error",
        messages: [createErrorMessage("Failed to change background")],
      });
    }
  }

  // private async handleMusicChange(file: File): Promise<void> {
  //   try {
  //     await this.audioManager.changeMusic(file);
  //   } catch (error) {
  //     console.error("Error changing music:", error);
  //     showMessage({
  //       isOpen: true,
  //       title: "Music Error",
  //       messages: [createErrorMessage("Failed to change music")],
  //     });
  //   }
  // }

  // private async handleCharacterChange(
  //   skelFile: File,
  //   atlasFile: File,
  //   pngFiles: File[]
  // ): Promise<void> {
  //   try {
  //     await this.characterManager.changeCharacter(
  //       skelFile,
  //       atlasFile,
  //       pngFiles
  //     );
  //   } catch (error) {
  //     console.error("Error changing character:", error);
  //     showMessage({
  //       isOpen: true,
  //       title: "Character Error",
  //       messages: [createErrorMessage("Failed to change character")],
  //     });
  //   }
  // }

  private async handleAssetsJson(file: File): Promise<void> {
    try {
      console.log("Starting to load assets JSON2");
      await this.assetService.handleAssetsJson(file);
    } catch (error) {
      console.error("Error loading assets JSON:", error);
      showMessage({
        isOpen: true,
        title: "Assets JSON Error",
        messages: [createErrorMessage("Failed to load assets JSON")],
      });
    }
  }

  private async handleTimelineJson(file: File): Promise<void> {
    try {
      await this.videoService.loadTimelineWithDelay(file);
    } catch (error) {
      console.error("Error processing timeline JSON:", error);
      showMessage({
        isOpen: true,
        title: "Timeline JSON Error",
        messages: [createErrorMessage("Failed to process timeline JSON")],
      });
    }
  }

  private async startRecording(): Promise<void> {
    try {
      await this.exportManager.startRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
      showMessage({
        isOpen: true,
        title: "Recording Error",
        messages: [createErrorMessage("Failed to start recording")],
      });
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      await this.exportManager.stopRecording();
    } catch (error) {
      console.error("Error stopping recording:", error);
      showMessage({
        isOpen: true,
        title: "Recording Error",
        messages: [createErrorMessage("Failed to stop recording")],
      });
    }
  }

  private stopAndRemoveScene(sceneKey: string): void {
    const scene = this.game.scene.getScene(sceneKey);
    if (scene) {
      scene.scene.stop();
      scene.scene.remove();
    }
  }

  destroy(): void {
    this.ui?.destroy();
    // this.videoService.cleanup();
    // this.characterManager.destroy();
    this.audioManager.destroy();
    this.exportManager.destroy();
    this.scale.removeListener("resize", this.handleResize, this);
  }
}
