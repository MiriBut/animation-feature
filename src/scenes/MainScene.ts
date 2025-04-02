import { Scene } from "phaser";
//import { BackgroundManager } from "../managers/BackgroundManager";
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
  //private backgroundManager!: BackgroundManager;
  //private characterManager!: CharacterManager;
  private audioManager!: AudioManager;
  private exportManager!: ExportManager;

  private readonly DEFAULT_WIDTH = 1920;
  private readonly DEFAULT_HEIGHT = 1080;

  private timelineFile!: File;
  private assetFile!: File;

  private width!: number;
  private height!: number;

  constructor() {
    console.log("02.04.25 version 0.2");
    super({ key: "MainScene" });
  }

  init(): void {
    console.log("Scene initialization started");

    // Initialize services first
    this.assetService = new AssetService(this);
    this.videoService = new VideoService(this, this.assetService);
    this.syncSystem = new SyncSystem(this);

    // Initialize managers
    // this.backgroundManager = new BackgroundManager(this);
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
        this.startRecording.bind(this),
        this.stopRecording.bind(this),
        this.handleAssetsJson.bind(this),
        this.handleTimelineJson.bind(this),
        this.assetService,
        this
      );
    }

    // Ensure camera is properly configured
    this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
    console.log("MainScene create completed");
  }

  private async cleanupAssetsAndTweens(): Promise<void> {
    try {
      console.log("Cleaning up assets and tweens before resolution change");

      // Stop all running tweens
      this.tweens.killAll();

      // Clear all animations in progress
      this.anims.pauseAll();
      //this.anims.stop();

      // Notify VideoService to clear assets
      await this.videoService.clearAllAssets();

      // Stop all audio
      this.audioManager.stopAllAudio();

      // Clear the sync system timeline
      this.syncSystem.reset();

      // חדש: ניקוי ישיר של כל האובייקטים בסצנה
      this.cleanupAllGameObjects();

      console.log("Assets and tweens cleanup completed");
    } catch (error) {
      console.error("Error during assets and tweens cleanup:", error);
    }
  }

  // פונקציה חדשה לניקוי ישיר של אובייקטים
  private cleanupAllGameObjects(): void {
    console.log("MainScene: Performing cleanup of specific game objects");

    // לקבל את כל האובייקטים בסצנה
    const allGameObjects = this.children.list;

    // מעבר על אובייקטים שנוצרו בתהליך הטעינה של אסטים ווידאו
    for (let i = allGameObjects.length - 1; i >= 0; i--) {
      const gameObject = allGameObjects[i];

      // נתעלם מאובייקטי בסיס ומערכת
      if (
        gameObject.name &&
        (gameObject.name.startsWith("ui_") ||
          gameObject.name === "camera" ||
          gameObject.name === "background" ||
          // אל תנקה אובייקטים קריטיים למערכת
          gameObject.name.includes("manager") ||
          gameObject.name.includes("service") ||
          gameObject.name.includes("system"))
      ) {
        console.log(`Skipping cleanup for ${gameObject.name}`);
        continue;
      }

      // ניקוי רק של אובייקטים ויזואליים
      try {
        if (
          gameObject instanceof Phaser.GameObjects.Sprite ||
          gameObject instanceof Phaser.GameObjects.Image ||
          gameObject instanceof Phaser.GameObjects.Video ||
          gameObject instanceof Phaser.GameObjects.Text
        ) {
          console.log(
            `Destroying visual game object: ${gameObject.name || "unnamed"}`
          );
          gameObject.destroy();
        }
        // טיפול זהיר יותר בקונטיינרים - ננקה רק אם הם לא קריטיים למערכת
        else if (
          gameObject instanceof Phaser.GameObjects.Container &&
          !gameObject.name?.includes("system") &&
          !gameObject.name?.includes("manager")
        ) {
          console.log(`Clearing container: ${gameObject.name || "unnamed"}`);
          gameObject.removeAll(true);
        }
      } catch (e) {
        console.warn(`Error during game object cleanup:`, e);
      }
    }
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

    this.width = width;
    this.height = height;

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

      // Clean up all assets and tweens before resolution change
      await this.cleanupAssetsAndTweens();

      // Get old dimensions from current scene size
      const oldWidth = this.scale.width;
      const oldHeight = this.scale.height;

      // Set new game size
      this.scale.setGameSize(width, height);

      // Update camera bounds and center it
      this.cameras.main.setBounds(0, 0, width, height);
      this.cameras.main.centerOn(width / 2, height / 2);

      // Notify VideoService to clear assets and prepare for new timeline
      await this.videoService.handleResolutionChange();

      // Reset AssetService first to ensure clean state - חדש
      await this.resetAssetService();

      // Update asset service - אחרי הרענון
      this.assetService.handleResize(oldWidth, oldHeight, width, height);

      // Update export manager resolution
      await this.exportManager.changeResolution(width, height);

      // Reload background if exists
      if (this.currentBackground) {
        await this.reloadBackground();
      }

      // Fade back in
      await new Promise<void>((resolve) => {
        this.cameras.main.fadeIn(
          300,
          0,
          0,
          0,
          (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress === 1) resolve();
          }
        );
      });

      console.log("Resolution update completed successfully");
    } catch (error) {
      console.error("Error updating resolution:", error);
      showMessage({
        isOpen: true,
        title: "Resolution Error",
        messages: [createErrorMessage("Failed to update resolution")],
      });

      // Reset camera to avoid black screen
      this.cameras.main.resetFX();
      this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
      this.cameras.main.centerOn(this.scale.width / 2, this.scale.height / 2);
    } finally {
      this.isResizing = false;
    }
  }

  public uiResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void {
    console.log(
      `Resolution changed from ${oldWidth}x${oldHeight} to ${newWidth}x${newHeight}`
    );

    if (this.assetFile) {
      //  this.handleAssetsJson(this.assetFile);
    }
    if (this.timelineFile) {
      // this.handleTimelineJson(this.timelineFile);
    }
    //  this.assetService.handleResize(oldWidth, oldHeight, newWidth, newHeight);
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

    // await this.backgroundManager.changeBackground(this.currentBackground);
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // private async handleBackgroundChange(file: File): Promise<void> {
  //   try {
  //     this.currentBackground = file;
  //     //  await this.backgroundManager.changeBackground(file);
  //   } catch (error) {
  //     console.error("Error changing background:", error);
  //     this.currentBackground = null;
  //     showMessage({
  //       isOpen: true,
  //       title: "Background Error",
  //       messages: [createErrorMessage("Failed to change background")],
  //     });
  //   }
  // }

  private async handleAssetsJson(file: File): Promise<void> {
    this.assetFile = file;
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
    this.timelineFile = file;

    //if already had changed
    if (this.width && this.height)
      this.videoService.handleResize(
        this.DEFAULT_WIDTH,
        this.DEFAULT_HEIGHT,
        this.width,
        this.height
      );

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
  private async resetAssetService(): Promise<void> {
    console.log("MainScene: Resetting AssetService");

    try {
      // קריאה לפונקציית reset אם קיימת
      if (typeof this.assetService.reset === "function") {
        await this.assetService.reset();
      }

      // או לחלופין, יצירה מחדש של AssetService אם צריך
      // this.assetService = new AssetService(this);

      console.log("AssetService reset successfully");
    } catch (error) {
      console.error("Error resetting AssetService:", error);
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
