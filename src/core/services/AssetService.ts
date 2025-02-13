import { Scene } from "phaser";
import {
  AssetElement,
  AssetJson,
  AssetDisplayProperties,
} from "../../types/interfaces/AssetInterfaces";
import { Validators } from "../utils/Validators";
import { Helpers } from "../utils/Helpers";
import {
  showMessage,
  createErrorMessage,
  createSuccessMessage,
} from "../../ui/ErrorModal/MessageModal";

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
    // console.log("00000000000000");
    // this.assetsMap.forEach((asset, key) => {
    //   console.log(key, asset);
    // });

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

  public async handleAssetsJson(
    json: AssetJson,
    missingAssets: string[]
  ): Promise<void> {
    const missingAssetsSet = new Set(missingAssets.map((name) => name.trim()));
    try {
      json.assets.forEach((asset: AssetElement) => {
        const assetName = asset.assetName.trim(); // לוודא שאין רווחים מיותרים

        if (!missingAssetsSet.has(assetName)) {
          this.assetsMap.set(assetName, {
            url: asset.assetUrl,
            type: asset.assetType,
          });
        }
      });

      const structureErrors = this.validateAssetStructure(json);
      if (structureErrors.length > 0) {
        showMessage({
          isOpen: true,
          title: "Asset File Structure Issues",
          messages: structureErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      const existenceErrors = await this.checkAssetsExistence(json.assets);
      if (existenceErrors.length > 0) {
        showMessage({
          isOpen: true,
          title: "Asset Files Not Found",
          messages: existenceErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      await this.loadAssets(json.assets);
      // showMessage({
      //   isOpen: true,
      //   title: "loading assets completed",
      //   messages: [
      //     createSuccessMessage(
      //       `${json.assets.length} ${
      //         json.assets.length === 1 ? "loaded asset" : "loaded assets"
      //       } successfully`
      //     ),
      //   ],
      //   autoClose: true,
      //   autoCloseTime: 3000,
      // });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "unknown loading assets error";
      showMessage({
        isOpen: true,
        title: "loading assets error",
        messages: [createErrorMessage(errorMessage)],
        autoClose: false,
      });
    }
  }

  public async loadAsset(
    assetName: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`++ Attempting to load asset: ${assetName}`);
    this.debugAssetsState();

    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.error(`++ ❌ Asset "${assetName}" not found in assets map`);
      return {
        success: false,
        error: `Asset "${assetName}" not found in assets map`,
      };
    }

    if (this.isAssetLoaded(assetName)) {
      console.log(`++ ✅ Asset "${assetName}" is already loaded`);
      return { success: true }; // לא נכשל, כי הנכס כבר קיים
    }

    const fileExtension = assetInfo.url.split(".").pop()?.toLowerCase();
    console.log(`++ Asset "${assetName}" has extension: ${fileExtension}`);

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      if (assetInfo.type === "image") {
        if (fileExtension === "webp") {
          console.log(`++ Loading WebP asset: ${assetName}`);
          const img = new Image();
          img.onload = () => {
            try {
              console.log(
                `++ Successfully loaded WebP image: ${assetName}, processing...`
              );

              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");

              if (!ctx) {
                console.error(
                  `++ ❌ Failed to get canvas context for: ${assetName}`
                );
                resolve({
                  success: false,
                  error: "Failed to get canvas context",
                });
                return;
              }

              ctx.drawImage(img, 0, 0);

              if (this.scene.textures.exists(assetName)) {
                console.log(`++ Removing existing texture for: ${assetName}`);
                this.scene.textures.remove(assetName);
              }

              this.scene.textures.addCanvas(assetName, canvas);
              this.loadedAssets.add(assetName);
              console.log(`++ ✅ Successfully added WebP asset: ${assetName}`);
              resolve({ success: true });
            } catch (error) {
              console.error(
                `++ ❌ Error processing WebP image: ${assetName}`,
                error
              );
              resolve({
                success: false,
                error:
                  error instanceof Error
                    ? `Error processing WebP: ${error.message}`
                    : `Unknown error: ${JSON.stringify(error)}`,
              });
            }
          };

          img.onerror = (error) => {
            console.error(
              `++ ❌ Failed to load WebP image: ${assetName}`,
              error
            );
            resolve({
              success: false,
              error: `Failed to load WebP image: ${assetName}`,
            });
          };

          img.src = assetInfo.url;
        } else {
          console.log(`++ Loading standard image asset: ${assetName}`);

          this.scene.load.image(assetName, assetInfo.url);

          this.scene.load.once("complete", () => {
            console.log(`++ 🔍 Checking if texture exists for: ${assetName}`);
            if (this.scene.textures.exists(assetName)) {
              this.loadedAssets.add(assetName);
              console.log(`++ ✅ Successfully loaded asset: ${assetName}`);
              resolve({ success: true });
            } else {
              console.error(`++ ❌ Texture not found after load: ${assetName}`);
              resolve({
                success: false,
                error: `Failed to load texture for asset: ${assetName}`,
              });
            }
          });

          this.scene.load.once("loaderror", (file: any) => {
            console.error(`++ ❌ Loader error for asset ${assetName}:`, file);
            resolve({
              success: false,
              error: `Loader error: Failed to load asset: ${assetName}`,
            });
          });

          this.scene.load.start();
        }
      } else {
        console.error(
          `++ ❌ Unsupported asset type: ${assetInfo.type} for ${assetName}`
        );
        resolve({
          success: false,
          error: `Unsupported asset type: ${assetInfo.type}`,
        });
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

    const loadPromises = assets.map(async (asset) => {
      const result = await this.loadAsset(asset.assetName);

      if (result.success) {
        return { assetName: asset.assetName, success: true };
      } else {
        return { assetName: asset.assetName, success: false };
      }
    });

    const results = await Promise.all(loadPromises);

    const successfulAssets = results.filter((result) => result.success);
    const failedAssets = results.filter((result) => !result.success);

    if (successfulAssets.length > 0) {
      console.log(
        "Successfully loaded assets:",
        successfulAssets.map((sa) => sa.assetName)
      );
    }

    // showMessage({
    //   isOpen: true,
    //   title: "Asset Loading Summary",
    //   messages: [
    //     `Successfully loaded ${successfulAssets.length} assets`,
    //     ...failedAssets.map(
    //       (fa) => `Asset "${fa.assetName}" could not be loaded`
    //     ),
    //   ],
    //   autoClose: failedAssets.length === 0,
    // });

    // אם אף אסט לא נטען, זרוק שגיאה
    if (successfulAssets.length === 0) {
      throw new Error("No assets could be loaded");
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
        // errors.push(
        //   `File not found: ${asset.assetName} (.${fileExtension} file)`
        // );

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
