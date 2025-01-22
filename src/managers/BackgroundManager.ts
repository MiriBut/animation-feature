import { Scene } from "phaser";
import { DEFAULT_ASSETS } from "../config/constants";

export class BackgroundManager {
  private scene: Scene;
  private background?: Phaser.GameObjects.Image;
  private hasChangedBackground: boolean = false;
  private loadingPromise?: Promise<void>;
  private maxTextureSize: number;

  constructor(scene: Scene) {
    this.scene = scene;
    this.maxTextureSize = this.getMaxTextureSize();
  }

  private getMaxTextureSize(): number {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      return gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }

    // Try WebGL2 if WebGL1 is not available
    const gl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (gl2) {
      return gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
    }

    return 4096; // Safe fallback for most devices
  }

  preload(): void {
    this.cleanClass();

    // Add error handling for texture loading
    this.scene.load.on("loaderror", (file: any) => {
      console.warn(`Failed to load texture: ${file.key}`);
    });

    this.loadingPromise = new Promise((resolve, reject) => {
      this.scene.load.once("complete", resolve);
      this.scene.load.once("loaderror", reject);

      this.scene.load.image(
        DEFAULT_ASSETS.background.key,
        DEFAULT_ASSETS.background.path
      );
    });
  }

  create(): void {
    if (!this.hasChangedBackground) {
      try {
        this.createDefaultBackground();
      } catch (error) {
        console.warn("Error creating default background:", error);
      }
    }
  }

  private createDefaultBackground(): void {
    if (!this.scene.textures.exists(DEFAULT_ASSETS.background.key)) {
      console.warn("Default background texture not found");
      return;
    }

    this.background = this.scene.add
      .image(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        DEFAULT_ASSETS.background.key
      )
      .setOrigin(0.5);

    this.resizeBackground();
  }

  private resizeBackground(): void {
    if (!this.background) return;

    const scaleX = this.scene.scale.width / this.background.width;
    const scaleY = this.scene.scale.height / this.background.height;
    const scale = Math.max(scaleX, scaleY);

    this.background.setScale(scale).setVisible(true);
  }

  async changeBackground(file: File): Promise<void> {
    try {
      // Ensure the file is an image
      if (!file.type.startsWith("image/")) {
        throw new Error("Invalid file type. Please select an image file.");
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
          if (typeof e.target?.result !== "string") {
            reject(new Error("Failed to read file"));
            return;
          }

          try {
            await this.loadAndSetBackground(e.target.result);
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error("Error changing background:", error);
      throw error;
    }
  }

  private async loadAndSetBackground(dataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Check image dimensions
          if (
            img.width > this.maxTextureSize ||
            img.height > this.maxTextureSize
          ) {
            reject(
              new Error(
                `Image dimensions exceed maximum texture size of ${this.maxTextureSize}px`
              )
            );
            return;
          }

          const textureKey = `user-bg-${Date.now()}`;
          this.hasChangedBackground = true;

          // Remove old background if it exists
          this.cleanClass();

          // Add new texture
          this.scene.textures.addImage(textureKey, img);

          // Create new background
          this.background = this.scene.add
            .image(
              this.scene.cameras.main.width / 2,
              this.scene.cameras.main.height / 2,
              textureKey
            )
            .setOrigin(0.5);

          this.resizeBackground();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  }

  private cleanClass() {
    if (this.background) {
      const oldTextureKey = this.background.texture.key;
      this.background.destroy();

      if (oldTextureKey !== DEFAULT_ASSETS.background.key) {
        try {
          this.scene.textures.remove(oldTextureKey);
        } catch (error) {
          console.warn("Error removing old texture:", error);
        }
      }
    }
  }
}
