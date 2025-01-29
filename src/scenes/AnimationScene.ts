import { Scene } from "phaser";
import { BackgroundManager } from "../managers/BackgroundManager";
import { SceneUI } from "../ui/SceneUI";
import { AudioManager } from "../managers/AudioManager";
import { CharacterManager } from "../managers/CharacterManager";
import { ExportManager } from "../managers/ExportManager";
import { ErrorModal } from "../ui/ErrorModal/ErrorModal";

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
        this.stopRecording.bind(this),
        this.onAssetsJson.bind(this),
        this.onTimelineJson.bind(this)
      );
    }

    this.isResizing = false;
  }

  private async validateAndHandleJson(file: File): Promise<any> {
    const text = await file.text();
    const json = JSON.parse(text);

    if (!json || typeof json !== "object") {
      throw new Error("קובץ JSON לא תקין");
    }

    const isTemplate = json["template video json"] !== undefined;
    const isAsset = json.assets !== undefined;

    if (!isTemplate && !isAsset) {
      throw new Error("לא ניתן לזהות את סוג קובץ ה-JSON");
    }

    return json;
  }

  private async onAssetsJson(file: File): Promise<void> {
    const errors: string[] = [];

    try {
      const json = (await this.validateAndHandleJson(file)) as AssetJson;

      if (!json.assets || !Array.isArray(json.assets)) {
        errors.push("Could not process JSON file - missing assets list");
        return;
      }

      // בדיקת כל הנכסים
      for (const asset of json.assets) {
        if (!asset.assetName || !asset.assetUrl || !asset.assetType) {
          errors.push(
            `Invalid asset: ${
              asset.assetName || "Unknown asset"
            } - missing required properties`
          );
          continue;
        }

        // בדיקת תקינות ה-URL
        try {
          new URL(asset.assetUrl, window.location.origin);
        } catch {
          errors.push(`Invalid URL for asset: ${asset.assetName}`);
          continue;
        }

        // בדיקה אם הקובץ קיים
        const exists = await this.checkAssetExists(asset.assetUrl);
        if (!exists) {
          const fileExtension = asset.assetUrl.split(".").pop() || "";
          errors.push(
            `Could not find file: ${asset.assetName} (.${fileExtension} file)`
          );
          continue;
        }
      }

      // אם יש שגיאות, מציגים אותן למשתמש
      if (errors.length > 0) {
        new ErrorModal({
          isOpen: true,
          title: "Issues Found in Assets File",
          errors: errors,
        });
        return;
      }

      // אם אין שגיאות, ממשיכים בטעינה
      let loadErrors = false;
      this.load.on("loaderror", (file: any) => {
        errors.push(`Failed to load: ${file.key}`);
        loadErrors = true;
      });

      for (const asset of json.assets) {
        if (asset.assetType === "image") {
          this.load.image(asset.assetName, asset.assetUrl);
        }
        // אפשר להוסיף כאן טיפול בסוגי נכסים נוספים
      }

      await new Promise<void>((resolve) => {
        this.load.once("complete", () => {
          if (loadErrors) {
            new ErrorModal({
              isOpen: true,
              title: "Asset Loading Issues",
              errors: errors,
            });
          }
          resolve();
        });
        this.load.start();
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new ErrorModal({
        isOpen: true,
        title: "Unexpected Error",
        errors: [
          `An error occurred while processing the assets file. Please try again.`,
        ],
      });
      console.error("Debug info:", errorMessage);
    }
  }

  private async checkAssetExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async onTimelineJson(file: File): Promise<void> {
    const errors: string[] = [];

    try {
      const json = await this.validateAndHandleJson(file);

      if (
        !json["template video json"] ||
        !Array.isArray(json["template video json"])
      ) {
        errors.push(
          "Could not process JSON file - missing template video json array"
        );
        new ErrorModal({
          isOpen: true,
          title: "Timeline JSON Structure Error",
          errors: errors,
        });
        return;
      }

      // בדיקת תקינות האלמנטים
      for (const element of json["template video json"]) {
        // בדיקת שדות חובה
        const missingFields = [];
        if (!element.elementName) missingFields.push("elementName");
        if (!element.assetType) missingFields.push("assetType");
        if (!element.assetName) missingFields.push("assetName");

        if (missingFields.length > 0) {
          errors.push(
            `Invalid element: ${
              element.elementName || "Unknown element"
            } - missing required fields: ${missingFields.join(", ")}`
          );
          continue;
        }

        // בדיקת תקינות ה-initialState
        if (element.initialState) {
          const state = element.initialState;
          // בדיקת מיקום
          if (
            state.position &&
            (typeof state.position.x !== "number" ||
              typeof state.position.y !== "number" ||
              typeof state.position.z !== "number")
          ) {
            errors.push(
              `Invalid position values for element: ${element.elementName}`
            );
          }

          // בדיקת scale
          if (
            state.scale &&
            (typeof state.scale.x !== "number" ||
              typeof state.scale.y !== "number")
          ) {
            errors.push(
              `Invalid scale values for element: ${element.elementName}`
            );
          }

          // בדיקת שקיפות
          if (
            state.opacity !== undefined &&
            (typeof state.opacity !== "number" ||
              state.opacity < 0 ||
              state.opacity > 1)
          ) {
            errors.push(
              `Invalid opacity value for element: ${element.elementName}`
            );
          }
        }

        // בדיקת תקינות ה-timeline
        if (element.timeline) {
          // בדיקת אנימציות scale
          if (element.timeline.scale) {
            for (const scaleAnim of element.timeline.scale) {
              if (
                scaleAnim.startTime == null ||
                scaleAnim.endTime == null ||
                scaleAnim.startValue == null ||
                scaleAnim.endValue == null
              ) {
                errors.push(
                  `Invalid scale animation for element: ${
                    element.elementName
                  } (startTime: ${scaleAnim.startTime}, endTime: ${
                    scaleAnim.endTime
                  }, startValue: ${JSON.stringify(
                    scaleAnim.startValue
                  )}, endValue: ${JSON.stringify(scaleAnim.endValue)})`
                );
              }
            }
          }

          // בדיקות דומות לשאר סוגי האנימציות
          // position, color, opacity, rotation
        }
      }

      // אם נמצאו שגיאות, מציגים אותן למשתמש
      if (errors.length > 0) {
        new ErrorModal({
          isOpen: true,
          title: "Issues Found in Timeline File",
          errors: errors,
        });
        return;
      }

      console.log("Timeline JSON processed successfully");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new ErrorModal({
        isOpen: true,
        title: "Unexpected Error",
        errors: [
          "An error occurred while processing the timeline file. Please check the file format and try again.",
        ],
      });
      console.error("Debug info:", errorMessage);
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
