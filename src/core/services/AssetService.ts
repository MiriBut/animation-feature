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
      sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Video;
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

  public getAssetInfo(assetName: string):
    | {
        url: string;
        type: string;
        sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Video;
      }
    | undefined {
    return this.assetsMap.get(assetName);
  }

  public debugAssetSizes(): void {
    console.log("=== Asset Sizes Debug Info ===");

    this.assetsMap.forEach((assetInfo, assetName) => {
      if (assetInfo.sprite) {
        let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Video =
          assetInfo.sprite;

        if (sprite instanceof Phaser.GameObjects.Sprite) {
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
      }
    });
  }

  public isAssetLoaded(assetName: string): boolean {
    const assetInfo = this.assetsMap.get(assetName);
    return (
      assetInfo !== undefined &&
      this.loadedAssets.has(assetName) &&
      ((assetInfo.type === "image" &&
        assetInfo.sprite instanceof Phaser.GameObjects.Sprite) ||
        (assetInfo.type === "video" &&
          assetInfo.sprite instanceof Phaser.GameObjects.Video))
    );
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
    const assetInfo = this.assetsMap.get(assetName);

    if (!assetInfo) {
      console.error(`++ ❌ Asset "${assetName}" not found in assets map`);
      return { success: false, error: `Asset not found` };
    }

    // בדיקה אם האסט כבר טעון
    if (this.isAssetLoaded(assetName)) {
      console.log(`++ ✅ Asset "${assetName}" is already loaded`);
      return { success: true };
    }

    const fileExtension = assetInfo.url.split(".").pop()?.toLowerCase();
    console.log(`Asset "${assetName}" has extension: ${fileExtension}`);

    return new Promise((resolve) => {
      if (assetInfo.type === "image") {
        // טעינה מקדימה של התמונה לבדיקת הממדים האמיתיים
        const img = new Image();
        img.onload = () => {
          console.log(
            `++ Image ${assetName} real dimensions: ${img.width}x${img.height}`
          );

          // טעינה ל-Phaser
          this.scene.load.image(assetName, assetInfo.url);

          this.scene.load.once("complete", () => {
            this.loadedAssets.add(assetName);
            const sprite = this.scene.add.sprite(0, 0, assetName);
            sprite.setVisible(false); // מוסתר בהתחלה

            this.assetsMap.set(assetName, {
              ...assetInfo,
              sprite: sprite,
            });

            resolve({ success: true });
          });

          this.scene.load.once("loaderror", () => {
            resolve({
              success: false,
              error: `Failed to load image: ${assetName}`,
            });
          });

          this.scene.load.start();
        };

        img.onerror = () => {
          resolve({
            success: false,
            error: `Failed to load image: ${assetName}`,
          });
        };

        img.src = assetInfo.url;
        return;
      }

      if (assetInfo.type === "video") {
        // MP4 וידאו
        if (fileExtension === "mp4") {
          fetch(assetInfo.url)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              this.scene.load.video(assetName, assetInfo.url);

              this.scene.load.once("complete", () => {
                console.log(`Video ${assetName} loaded successfully`);
                this.loadedAssets.add(assetName);

                const video = this.scene.add.video(0, 0, assetName);
                video.setVisible(false); // מוסתר בהתחלה

                this.assetsMap.set(assetName, {
                  ...assetInfo,
                  sprite: video,
                });

                resolve({ success: true });
              });

              this.scene.load.once("loaderror", () => {
                resolve({
                  success: false,
                  error: `Failed to load MP4 video: ${assetName}`,
                });
              });

              this.scene.load.start();
            })
            .catch((error) => {
              resolve({
                success: false,
                error: `Failed to fetch video: ${assetName}`,
              });
            });
          return;
        }

        // סוגי וידאו אחרים...
        if (fileExtension === "webm") {
          this.scene.load.video(assetName, assetInfo.url);
          this.scene.load.once("complete", () => {
            this.loadedAssets.add(assetName);
            resolve({ success: true });
          });
          this.scene.load.once("loaderror", () => {
            resolve({
              success: false,
              error: `Failed to load WebM video: ${assetName}`,
            });
          });
          this.scene.load.start();
          return;
        }

        // פורמטים לא נתמכים
        resolve({
          success: false,
          error: `Unsupported video format: ${fileExtension}`,
        });
        return;
      }

      // סוג אסט לא נתמך
      console.error(
        `❌ Unsupported asset type: ${assetInfo.type} for ${assetName}`
      );
      resolve({
        success: false,
        error: `Unsupported asset type: ${assetInfo.type}`,
      });
    });
  }

  public displayAsset(
    assetName: string,
    properties: AssetDisplayProperties
  ): Phaser.GameObjects.Sprite | Phaser.GameObjects.Video {
    console.log(`++ Displaying asset: ${assetName}`);

    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.error(`++ ❌ No asset info found for: ${assetName}`);
      throw new Error(`Asset ${assetName} not loaded`);
    }

    // הרס האסט הקודם אם קיים
    if (assetInfo.sprite) {
      if (assetInfo.sprite instanceof Phaser.GameObjects.Video) {
        assetInfo.sprite.stop();
      }
      assetInfo.sprite.destroy();
    }

    const centerX = this.scene.cameras.main.centerX;
    const centerY = this.scene.cameras.main.centerY;

    console.log(`++ Scene center: ${centerX}, ${centerY}`);
    console.log(`++ Asset position offset: ${properties.x}, ${properties.y}`);

    if (assetInfo.type === "video") {
      console.log("++ Displaying video asset");
      const video = this.scene.add.video(
        centerX + properties.x,
        centerY + properties.y,
        assetName
      );

      video.setOrigin(0.5, 0.5);
      video.setScale(properties.scale);
      video.setAlpha(properties.alpha);
      video.setVisible(true);
      video.play(true);

      console.log(`++ Video position: ${video.x}, ${video.y}`);
      console.log(`++ Video scale: ${video.scaleX}, ${video.scaleY}`);
      console.log(`++ Video dimensions: ${video.width}x${video.height}`);

      this.assetsMap.set(assetName, {
        ...assetInfo,
        sprite: video,
      });

      return video;
    }

    console.log("++ Displaying image asset");
    const sprite = this.scene.add.sprite(
      centerX + properties.x,
      centerY + properties.y,
      assetName
    );

    // בדיקת הממדים
    const texture = sprite.texture;
    const sourceImage = texture.getSourceImage();
    console.log(`++ Sprite dimensions:`, {
      sourceWidth: sourceImage.width,
      sourceHeight: sourceImage.height,
      displayWidth: sprite.displayWidth,
      displayHeight: sprite.displayHeight,
      position: `${sprite.x}, ${sprite.y}`,
      visible: sprite.visible,
      alpha: sprite.alpha,
    });

    // עדכון מפת האסטים
    this.assetsMap.set(assetName, {
      ...assetInfo,
      sprite,
    });

    // הגדרת תכונות בסיסיות
    const anchorX = properties.anchor?.x ?? 0.5;
    const anchorY = properties.anchor?.y ?? 0.5;
    sprite.setOrigin(anchorX, anchorY);
    sprite.setAlpha(properties.alpha);
    sprite.setVisible(true);

    // טיפול בסקיילינג
    if (properties.ratio) {
      const targetRatio = properties.ratio.width / properties.ratio.height;
      const currentRatio = sourceImage.width / sourceImage.height;

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

    console.log(`++ Final sprite scale: ${sprite.scaleX}, ${sprite.scaleY}`);

    // תכונות נוספות
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

    if (sprite instanceof Phaser.GameObjects.Video) {
      if (properties.x !== undefined || properties.y !== undefined) {
        sprite.setPosition(properties.x ?? sprite.x, properties.y ?? sprite.y);
      }
      if (properties.scale !== undefined) {
        sprite.setScale(properties.scale);
      }
      if (properties.alpha !== undefined) {
        sprite.setAlpha(properties.alpha);
      }
      return;
    }

    if (sprite instanceof Phaser.GameObjects.Sprite) {
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
  }

  public hideAllAssets(): void {
    for (const [assetName, assetInfo] of this.assetsMap.entries()) {
      if (assetInfo.sprite) {
        if (assetInfo.sprite instanceof Phaser.GameObjects.Video) {
          assetInfo.sprite.stop();
          assetInfo.sprite.destroy();
        } else if (assetInfo.sprite instanceof Phaser.GameObjects.Sprite) {
          assetInfo.sprite.destroy();
        }

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
        hasSprite:
          value.sprite instanceof Phaser.GameObjects.Sprite ||
          value.sprite instanceof Phaser.GameObjects.Video,
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
        return {
          assetName: asset.assetName,
          success: false,
          error: result.error,
        };
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

    if (failedAssets.length > 0) {
      console.log(
        "Failed to load assets:",
        failedAssets.map((fa) => `${fa.assetName}: ${fa.error}`)
      );
    }

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

      try {
        const exists = await Helpers.checkAssetExists(asset.assetUrl);
        console.log(`Asset ${asset.assetName} exists: ${exists}`);

        if (!exists) {
          const fileExtension = asset.assetUrl.split(".").pop() || "";

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

            if (response.status !== 200) {
              errors.push(`Asset ${asset.assetName} could not be accessed`);
            }
          } catch (error) {
            console.error(`Direct fetch error for ${asset.assetName}:`, error);
            errors.push(`Failed to fetch asset ${asset.assetName}`);
          }
        }
      } catch (checkError) {
        console.error(`Error checking asset ${asset.assetName}:`, checkError);
        errors.push(`Could not verify asset ${asset.assetName}`);
      }
    }

    return errors;
  }

  private getAssetTypesSummary(json: AssetJson): string {
    const typeCount = new Map<string, number>();
    json.assets.forEach((asset) => {
      const count = typeCount.get(asset.assetType) || 0;
      typeCount.set(asset.assetType, count + 1);
    });

    return Array.from(typeCount.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
      .join(", ");
  }

  private getDetailedErrorMessage(error: Error, fileName: string): string {
    if (error.message.includes("JSON")) {
      return `Invalid JSON format in ${fileName}: Please check the file structure`;
    }
    if (error.message.includes("asset")) {
      return `${error.message} in ${fileName}`;
    }
    return `${error.message} in ${fileName}`;
  }
}
