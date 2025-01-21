// src/managers/BackgroundManager.ts

import { Scene } from "phaser";
import { DEFAULT_ASSETS } from "../config/constants";

export class BackgroundManager {
  private scene: Scene;
  private background?: Phaser.GameObjects.Image;
  private hasChanedBackground?: boolean;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  preload(): void {
    this.cleanClass();

    this.scene.load.image(
      DEFAULT_ASSETS.background.key,
      DEFAULT_ASSETS.background.path
    );
  }

  create(): void {
    if (!this.hasChanedBackground) {
      this.background = this.scene.add
        .image(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2,
          DEFAULT_ASSETS.background.key
        )
        .setOrigin(0.5)
        .setDisplaySize(this.scene.scale.width, this.scene.scale.height)
        .setVisible(true);
    }
  }

  async changeBackground(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          const img = new Image();
          img.onload = () => {
            const textureKey = `user-bg-${Date.now()}`;
            this.hasChanedBackground = true;
            this.scene.textures.addImage(textureKey, img);

            if (this.background) {
              const oldTextureKey = this.background.texture.key;
              this.background.destroy();

              if (oldTextureKey !== DEFAULT_ASSETS.background.key) {
                this.scene.textures.remove(oldTextureKey);
              }
            }

            this.background = this.scene.add
              .image(
                this.scene.cameras.main.width / 2,
                this.scene.cameras.main.height / 2,
                textureKey
              )
              .setOrigin(0.5)
              .setDisplaySize(this.scene.scale.width, this.scene.scale.height)
              .setVisible(true);

            resolve();
          };
          img.src = e.target.result;
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  private cleanClass() {
    if (this.background) {
      const oldTextureKey = this.background.texture.key;
      this.background.destroy();

      if (oldTextureKey !== DEFAULT_ASSETS.background.key) {
        this.scene.textures.remove(oldTextureKey);
      }
    }
  }
}
