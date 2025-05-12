import { Scene, Time } from "phaser";
import { AudioManager } from "../managers/AudioManager";
import { ExportManager } from "../managers/ExportManager";
import { AssetService } from "../core/services/AssetService";
import { VideoService } from "../core/services/VideoService";
import { TimelineService } from "../core/services/TimelineService";
import { SceneUI } from "../ui/SceneUI";
import { SyncSystem } from "../core/animation/SyncSystem";
import { showMessage, createErrorMessage } from "../ui/ErrorModal/MessageModal";
import "../core/animation/animations";
import { TimelineJson } from "@/types/interfaces/TimelineInterfaces";
import { AnchorPositionDebugger } from "../core/services/AnchorPositionDebugger";

export class MainScene extends Scene {
  private ui?: SceneUI;
  private isResizing: boolean = false;

  // Services
  private assetService!: AssetService;
  private timelineService!: TimelineService;
  private videoService!: VideoService;
  private syncSystem!: SyncSystem;
  private anchorPositionDebugger!: AnchorPositionDebugger;

  // Managers
  private audioManager!: AudioManager;
  private exportManager!: ExportManager;

  private readonly DEFAULT_WIDTH = 1920;
  private readonly DEFAULT_HEIGHT = 1080;

  private timelineFile!: File;
  private assetFile!: File;

  private width!: number;
  private height!: number;

  constructor() {
    console.log("11.5.25 version 1.2");
    super({ key: "MainScene" });
  }

  init(): void {
    // Initialize services first
    this.assetService = new AssetService(this);
    this.timelineService = new TimelineService(
      this.assetService.getAssetsMap(),
      this.assetService,
      this
    );
    this.videoService = new VideoService(
      this,
      this.assetService,
      this.assetService.getAssetsMap()
    );
    this.syncSystem = new SyncSystem(this);

    this.audioManager = new AudioManager(this);
    this.exportManager = new ExportManager(this, this.audioManager);

    this.stopAndRemoveScene("default");
    this.stopAndRemoveScene("bootScene");
  }

  preload(): void {}

  async create(): Promise<void> {
    this.initializeScene();

    this.audioManager = new AudioManager(this);

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

    // Initialize AnchorPositionDebugger
    const width = this.width || this.scale.width;
    const height = this.height || this.scale.height;
    const widthRatio = width / this.DEFAULT_WIDTH;
    const heightRatio = height / this.DEFAULT_HEIGHT;
    this.anchorPositionDebugger = new AnchorPositionDebugger(
      this,
      width,
      height,
      widthRatio,
      heightRatio
    );
  }

  private async cleanupAssetsAndTweens(): Promise<void> {
    try {
      // Stop all running tweens
      this.tweens.killAll();

      // Clear all animations in progress
      this.anims.pauseAll();

      // Notify VideoService to clear assets
      await this.videoService.clearAllAssets();

      // Stop all audio
      this.audioManager.stopAllAudio();

      // Clear the sync system timeline
      this.syncSystem.reset();

      this.cleanupAllGameObjects();
    } catch (error) {
      console.error("Error during assets and tweens cleanup:", error);
    }
  }

  private cleanupAllGameObjects(): void {
    const allGameObjects = this.children.list;

    for (let i = allGameObjects.length - 1; i >= 0; i--) {
      const gameObject = allGameObjects[i];

      // Ignore base and system objects
      if (
        gameObject.name &&
        (gameObject.name.startsWith("ui_") ||
          gameObject.name === "camera" ||
          gameObject.name === "background" ||
          gameObject.name.includes("manager") ||
          gameObject.name.includes("service") ||
          gameObject.name.includes("system"))
      ) {
        continue;
      }

      try {
        if (
          gameObject instanceof Phaser.GameObjects.Sprite ||
          gameObject instanceof Phaser.GameObjects.Image ||
          gameObject instanceof Phaser.GameObjects.Video ||
          gameObject instanceof Phaser.GameObjects.Text
        ) {
          gameObject.destroy();
        }
        // Handle containers more carefully - only clean them if they are not critical to the system
        else if (
          gameObject instanceof Phaser.GameObjects.Container &&
          !gameObject.name?.includes("system") &&
          !gameObject.name?.includes("manager")
        ) {
          gameObject.removeAll(true);
        }
      } catch (e) {
        console.warn(`Error during game object cleanup:`, e);
      }
    }
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

  private async updateResolution(width: number, height: number): Promise<void> {
    if (this.isResizing) {
      return;
    }

    this.width = width;
    this.height = height;
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
      // Update AnchorPositionDebugger with new dimensions
      this.anchorPositionDebugger.updateResolution(
        this.width,
        this.height,
        this.width / this.DEFAULT_WIDTH,
        this.height / this.DEFAULT_HEIGHT
      );

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
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (this.isResizing) return;

    const { width, height } = gameSize;
    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBounds(0, 0, width, height);

    // Update AnchorPositionDebugger with new dimensions
    this.anchorPositionDebugger.updateResolution(
      width,
      height,
      width / this.DEFAULT_WIDTH,
      height / this.DEFAULT_HEIGHT
    );
  }

  private async handleAssetsJson(file: File): Promise<void> {
    this.assetFile = file;
    try {
      console.log("Starting to load assets JSON");
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
      const fileContent = await file.text();
      const timeline = JSON.parse(fileContent) as TimelineJson;

      await this.timelineService.validateTimelineJson(timeline);
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
    try {
      if (typeof this.assetService.reset === "function") {
        await this.assetService.reset();
      }
    } catch (error) {
      console.error("Error resetting AssetService:", error);
    }
  }
  destroy(): void {
    this.ui?.destroy();
    this.audioManager.destroy();
    this.exportManager.destroy();

    this.scale.removeListener("resize", this.handleResize, this);
  }
}
