import { Scene } from "phaser";
import {
  AssetElement,
  AssetJson,
  AssetDisplayProperties,
} from "../../types/interfaces/AssetInterfaces";
import { Validators } from "../utils/Validators";
import { Helpers } from "../utils/Helpers";
import { showMessage } from "../../ui/ErrorModal/MessageModal";

export class AssetService {
  private scene: Scene;
  private loadedAssets: Set<string> = new Set();
  private assetsMap: Map<
    string,
    {
      url: string;
      type: string;
      sprite?: Phaser.GameObjects.Sprite;
    }
  > = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public getAssetsMap(): Map<string, { url: string; type: string }> {
    return new Map(this.assetsMap);
  }

  public getAssetInfo(
    assetName: string
  ): { url: string; type: string } | undefined {
    return this.assetsMap.get(assetName);
  }

  public debugAssetSizes(): void {
    console.log("=== Asset Sizes Debug Info ===");

    this.assetsMap.forEach((assetInfo, assetName) => {
      if (assetInfo.sprite) {
        const sprite = assetInfo.sprite;
        const texture = sprite.texture;
        const sourceImage = texture.getSourceImage();

        console.log(`Asset: ${assetName}`);
        console.log(
          `- Original Size: ${sourceImage.width}x${sourceImage.height}`
        );
        console.log(
          `- Display Size: ${sprite.displayWidth}x${sprite.displayHeight}`
        );
        console.log(`- Scale: ${sprite.scaleX}x${sprite.scaleY}`);
        console.log(`- Origin: ${sprite.originX}x${sprite.originY}`);
        console.log("------------------------");
      }
    });
  }

  public isAssetLoaded(assetName: string): boolean {
    return this.loadedAssets.has(assetName);
  }

  public async handleAssetsJson(json: AssetJson): Promise<void> {
    try {
      json.assets.forEach((asset: AssetElement) => {
        this.assetsMap.set(asset.assetName, {
          url: asset.assetUrl,
          type: asset.assetType,
        });
      });

      const structureErrors = this.validateAssetStructure(json);
      if (structureErrors.length > 0) {
        showMessage({
          isOpen: true,
          type: "error",
          title: "Asset File Structure Issues",
          messages: structureErrors,
        });
        return;
      }

      const existenceErrors = await this.checkAssetsExistence(json.assets);
      if (existenceErrors.length > 0) {
        showMessage({
          isOpen: true,
          type: "error",
          title: "Asset Files Not Found",
          messages: existenceErrors,
        });
        return;
      }

      await this.loadAssets(json.assets);
      this.debugAssetsState();
    } catch (error: unknown) {
      Helpers.handleError(error);
    }
  }

  public async loadAsset(assetName: string): Promise<void> {
    console.log(`Attempting to load asset: ${assetName}`);
    this.debugAssetsState();

    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.error("Available assets:", Array.from(this.assetsMap.keys()));
      throw new Error(`Asset ${assetName} not found in assets map`);
    }

    if (this.isAssetLoaded(assetName)) {
      console.log(`Asset ${assetName} is already loaded`);
      return;
    }

    const fileExtension = assetInfo.url.split(".").pop()?.toLowerCase();
    console.log(`Asset ${assetName} has extension: ${fileExtension}`);

    return new Promise<void>((resolve, reject) => {
      if (assetInfo.type === "image") {
        if (fileExtension === "webp") {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");

              if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
              }

              ctx.drawImage(img, 0, 0);

              if (this.scene.textures.exists(assetName)) {
                console.log(`Removing existing texture for: ${assetName}`);
                this.scene.textures.remove(assetName);
              }

              this.scene.textures.addCanvas(assetName, canvas);
              this.loadedAssets.add(assetName);
              console.log(`Successfully loaded WebP asset: ${assetName}`);
              resolve();
            } catch (error) {
              console.error(`Error processing WebP image: ${assetName}`, error);
              reject(error);
            }
          };

          img.onerror = (error) => {
            console.error(`Failed to load WebP image: ${assetName}`, error);
            reject(new Error(`Failed to load WebP image: ${assetName}`));
          };

          img.src = assetInfo.url;
        } else {
          this.scene.load.image(assetName, assetInfo.url);

          this.scene.load.once("complete", () => {
            if (this.scene.textures.exists(assetName)) {
              this.loadedAssets.add(assetName);
              console.log(`Successfully loaded asset: ${assetName}`);
              resolve();
            } else {
              console.error(`Failed to load texture for asset: ${assetName}`);
              reject(new Error(`Failed to load asset: ${assetName}`));
            }
          });

          this.scene.load.once("loaderror", (file: any) => {
            console.error(`Loader error for asset ${assetName}:`, file);
            reject(new Error(`Failed to load asset: ${assetName}`));
          });

          this.scene.load.start();
        }
      } else {
        reject(
          new Error(
            `Unsupported asset type: ${assetInfo.type} for ${assetName}`
          )
        );
      }
    });
  }

  public displayAsset(
    assetName: string,
    properties: AssetDisplayProperties
  ): Phaser.GameObjects.Sprite {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo || !this.isAssetLoaded(assetName)) {
      throw new Error(`Asset ${assetName} not loaded`);
    }

    if (assetInfo.sprite) {
      assetInfo.sprite.destroy();
    }

    const centerX = this.scene.cameras.main.centerX;
    const centerY = this.scene.cameras.main.centerY;

    const sprite = this.scene.add.sprite(
      centerX + properties.x,
      centerY + properties.y,
      assetName
    );

    const texture = sprite.texture;
    const sourceImage = texture.getSourceImage();
    console.log(`Creating sprite for ${assetName}:`);
    console.log(
      `- Original dimensions: ${sourceImage.width}x${sourceImage.height}`
    );
    console.log(`- Requested scale: ${properties.scale}`);
    if (properties.ratio) {
      console.log(
        `- Requested ratio: ${properties.ratio.width}:${properties.ratio.height}`
      );
    }

    this.assetsMap.set(assetName, {
      ...assetInfo,
      sprite,
    });

    // טיפול ב-anchor
    const anchorX = properties.anchor?.x ?? 0.5;
    const anchorY = properties.anchor?.y ?? 0.5;
    sprite.setOrigin(anchorX, anchorY);

    // טיפול בסקיילינג עם aspect ratio
    if (properties.ratio) {
      const texture = sprite.texture;
      const originalWidth = texture.getSourceImage().width;
      const originalHeight = texture.getSourceImage().height;

      const targetRatio = properties.ratio.width / properties.ratio.height;
      const currentRatio = originalWidth / originalHeight;

      let scaleX = properties.scale;
      let scaleY = properties.scale;

      if (targetRatio > currentRatio) {
        scaleY = scaleX * (currentRatio / targetRatio);
      } else {
        scaleX = scaleY * (targetRatio / currentRatio);
      }

      sprite.setScale(scaleX, scaleY);
    } else {
      sprite.setScale(properties.scale);
    }

    sprite.setAlpha(properties.alpha);

    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }

    if (properties.tint !== undefined) {
      sprite.setTint(properties.tint);
    }

    if (properties.pivot) {
      sprite.setOrigin(properties.pivot.x, properties.pivot.y);
    }

    return sprite;
  }

  public updateAssetProperties(
    assetName: string,
    properties: Partial<{
      x: number;
      y: number;
      scale: number;
      alpha: number;
      rotation: number;
    }>
  ): void {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo?.sprite) return;

    const sprite = assetInfo.sprite;

    if (properties.x !== undefined || properties.y !== undefined) {
      sprite.setPosition(properties.x ?? sprite.x, properties.y ?? sprite.y);
    }
    if (properties.scale !== undefined) {
      sprite.setScale(properties.scale);
    }
    if (properties.alpha !== undefined) {
      sprite.setAlpha(properties.alpha);
    }
    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }
  }

  public hideAllAssets(): void {
    for (const [assetName, assetInfo] of this.assetsMap.entries()) {
      if (assetInfo.sprite) {
        assetInfo.sprite.destroy();
        this.assetsMap.set(assetName, {
          url: assetInfo.url,
          type: assetInfo.type,
        });
      }
    }
  }

  public debugAssetsState(): void {
    console.log("=== Assets Debug Info ===");
    console.log("Loaded Assets:", Array.from(this.loadedAssets));
    console.log("Assets Map:");
    this.assetsMap.forEach((value, key) => {
      console.log(`- ${key}:`, {
        url: value.url,
        type: value.type,
        isLoaded: this.loadedAssets.has(key),
        hasSprite: !!value.sprite,
      });
    });
  }

  private async loadAssets(assets: AssetElement[]): Promise<void> {
    console.log(
      "Starting to load assets:",
      assets.map((a) => a.assetName)
    );

    try {
      await Promise.all(assets.map((asset) => this.loadAsset(asset.assetName)));
      console.log("All assets loaded successfully");
    } catch (error) {
      console.error("Failed to load assets:", error);
      throw error;
    }
  }

  private validateAssetStructure(json: AssetJson): string[] {
    const errors: string[] = [];

    if (!json.assets || !Array.isArray(json.assets)) {
      errors.push("Invalid JSON structure - missing assets array");
      return errors;
    }

    json.assets.forEach((asset, index) => {
      const assetErrors = Validators.validateAssetObject(asset, index);
      errors.push(...assetErrors);
    });

    return errors;
  }

  private async checkAssetsExistence(
    assets: AssetElement[]
  ): Promise<string[]> {
    const errors: string[] = [];

    for (const asset of assets) {
      console.log(
        `Checking existence of asset: ${asset.assetName} at URL: ${asset.assetUrl}`
      );
      const exists = await Helpers.checkAssetExists(asset.assetUrl);
      console.log(`Asset ${asset.assetName} exists: ${exists}`);

      if (!exists) {
        const fileExtension = asset.assetUrl.split(".").pop() || "";
        errors.push(
          `File not found: ${asset.assetName} (.${fileExtension} file)`
        );

        try {
          const response = await fetch(asset.assetUrl);
          const headerObj: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headerObj[key] = value;
          });

          console.log(`Direct fetch response for ${asset.assetName}:`, {
            status: response.status,
            statusText: response.statusText,
            headers: headerObj,
          });
        } catch (error) {
          console.error(`Direct fetch error for ${asset.assetName}:`, error);
        }
      }
    }

    return errors;
  }
}
