import { Scene } from "phaser";
import { Asset, AssetJson, AssetInfo } from "./Interfaces";
import { Validators } from "./Validators";
import { Helpers } from "./Helpers";
import { showMessage } from "../ui/ErrorModal/MessageModal";

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
    // Return a copy of the map to prevent external modification
    return new Map(this.assetsMap);
  }

  public async handleAssetsJson(json: AssetJson): Promise<void> {
    try {
      // Map assets for future reference
      json.assets.forEach((asset: Asset) => {
        this.assetsMap.set(asset.assetName, {
          url: asset.assetUrl,
          type: asset.assetType,
        });
      });

      // Validate structure
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

      // Check file existence
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

      // Load assets
      await this.loadAssets(json.assets);
    } catch (error: unknown) {
      Helpers.handleError(error);
    }
  }

  public getAssetInfo(
    assetName: string
  ): { url: string; type: string } | undefined {
    return this.assetsMap.get(assetName);
  }

  public isAssetLoaded(assetName: string): boolean {
    return this.loadedAssets.has(assetName);
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

  private async checkAssetsExistence(assets: Asset[]): Promise<string[]> {
    const errors: string[] = [];

    for (const asset of assets) {
      const exists = await Helpers.checkAssetExists(asset.assetUrl);
      if (!exists) {
        const fileExtension = asset.assetUrl.split(".").pop() || "";
        errors.push(
          `File not found: ${asset.assetName} (.${fileExtension} file)`
        );
      }
    }

    return errors;
  }

  private async loadAssets(assets: Asset[]): Promise<void> {
    let loadErrors = false;
    const loadingErrors: string[] = [];

    // קודם הוסף את כל הנכסים ל-loader
    for (const asset of assets) {
      if (asset.assetType === "image") {
        this.scene.load.image(asset.assetName, asset.assetUrl);
      }
    }

    // רק אחר כך התחל את הטעינה
    return new Promise<void>((resolve, reject) => {
      this.scene.load.once("complete", () => {
        // בדוק שכל הנכסים נטענו
        const missingAssets = assets.filter(
          (asset) => !this.scene.textures.exists(asset.assetName)
        );

        if (missingAssets.length > 0) {
          reject(
            new Error(
              `Failed to load assets: ${missingAssets
                .map((a) => a.assetName)
                .join(", ")}`
            )
          );
          return;
        }

        // עדכן את ה-loadedAssets רק אחרי טעינה מוצלחת
        assets.forEach((asset) => this.loadedAssets.add(asset.assetName));

        resolve();
      });

      this.scene.load.start();
    });
  }

  public displayAsset(
    assetName: string,
    properties: {
      x: number;
      y: number;
      scale: number;
      alpha: number;
      rotation?: number;
    }
  ): void {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo || !this.isAssetLoaded(assetName)) {
      console.warn(`Asset ${assetName} not loaded`);
      return;
    }

    // וודא שאין sprite קיים
    if (assetInfo.sprite) {
      assetInfo.sprite.destroy();
    }

    // קבל את מיקום המרכז של המסך
    const centerX = this.scene.cameras.main.centerX;
    const centerY = this.scene.cameras.main.centerY;

    // צור sprite חדש במיקום הנכון
    const sprite = this.scene.add.sprite(
      centerX + properties.x,
      centerY + properties.y,
      assetName
    );

    // עדכן את ה-sprite במפה
    this.assetsMap.set(assetName, {
      ...assetInfo,
      sprite,
    });

    // הגדר את נקודת המקור למרכז
    sprite.setOrigin(0.5, 0.5);

    // החל את שאר המאפיינים
    sprite.setScale(properties.scale);
    sprite.setAlpha(properties.alpha);

    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }
  }

  // Update method to handle property changes
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

  // Method to hide all sprites
  public hideAllAssets(): void {
    this.assetsMap.forEach((assetInfo) => {
      if (assetInfo.sprite) {
        assetInfo.sprite.destroy();
        // הסר את ההפניה ל-sprite
        const { sprite, ...rest } = assetInfo;
        this.assetsMap.set(assetInfo.url, rest);
      }
    });
  }
}
