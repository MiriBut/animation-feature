import { Scene } from "phaser";
import {
  AssetElement,
  AssetJson,
  AssetDisplayProperties,
  AssetInfo,
  ParticleAssetInfo,
  ImageAssetInfo,
  VideoAssetInfo,
  SpineAssetInfo,
} from "../../types/interfaces/AssetInterfaces";
import {
  showMessage,
  createErrorMessage,
  createSuccessMessage,
  createInfoMessage,
} from "../../ui/ErrorModal/MessageModal";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";

export class AssetService {
  getAssetElement(assetName: string) {
    throw new Error("Method not implemented.");
  }
  private scene: Scene;
  private loadedAssets: Set<string> = new Set();
  private assetsMap: Map<string, AssetInfo> = new Map();
  private successMessages: string[] = [];
  private spineCharacter: SpineGameObject | null = null;
  private assetsLoaded: boolean = false;
  private lastFailedSpines = new Map<string, number>();

  constructor(scene: Scene) {
    this.scene = scene;
    console.log("-- AssetService: Constructor initialized with scene:", scene);
  }

  // === Asset Management Methods ===
  public getAssetsMap(): Map<string, AssetInfo> {
    console.log(
      "-- AssetService: getAssetsMap called, returning assetsMap with size:",
      this.assetsMap.size
    );
    return new Map(this.assetsMap);
  }

  public getAssetInfo(assetName: string): AssetInfo | undefined {
    console.log(`-- AssetService: getAssetInfo called for ${assetName}`);
    const assetInfo = this.assetsMap.get(assetName);
    console.log(
      `-- AssetService: getAssetInfo result for ${assetName}:`,
      assetInfo
    );
    return assetInfo;
  }

  public setAssetInfo(assetName: string, assetInfo: AssetInfo): void {
    console.log(
      `-- AssetService: setAssetInfo called for ${assetName} with info:`,
      assetInfo
    );
    this.assetsMap.set(assetName, assetInfo);
    this.successMessages.push(
      `setAssetInfo [Updates asset info in the map for ${assetName}]`
    );
    console.log(
      `-- AssetService: setAssetInfo updated assetsMap for ${assetName}, new size:`,
      this.assetsMap.size
    );
  }

  // === Asset Loading Methods ===
  public async handleAssetsJson(file: File): Promise<void> {
    console.log(
      "-- AssetService: handleAssetsJson started with file:",
      file.name
    );
    try {
      const fileContent = await file.text();
      console.log(
        "-- AssetService: handleAssetsJson file content length:",
        fileContent.length
      );
      const json = JSON.parse(fileContent) as AssetJson;
      console.log("-- AssetService: handleAssetsJson parsed JSON:", json);

      const structureErrors = this.validateAssetStructure(json);
      if (structureErrors.length > 0) {
        console.log(
          "-- AssetService: handleAssetsJson validation errors:",
          structureErrors
        );
        showMessage({
          isOpen: true,
          title: "Asset File Validation Errors",
          messages: structureErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      const existenceErrors = await this.checkAssetsExistence(json.assets);
      if (existenceErrors.length > 0) {
        console.log(
          "-- AssetService: handleAssetsJson existence errors:",
          existenceErrors
        );
        showMessage({
          isOpen: true,
          title: `Asset Accessibility Issues (${existenceErrors.length})`,
          messages: existenceErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      console.log("-- AssetService: handleAssetsJson registering assets...");
      await this.registerAssets(json.assets);
      console.log("-- AssetService: handleAssetsJson loading assets...");
      const loadResults = await this.loadAssets(json.assets);
      console.log(
        "-- AssetService: handleAssetsJson load results:",
        loadResults
      );
      this.displayLoadResults(loadResults);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during asset processing";
      console.log("-- AssetService: handleAssetsJson error:", errorMessage);
      showMessage({
        isOpen: true,
        title: "Asset Processing Error",
        messages: [createErrorMessage(errorMessage)],
        autoClose: false,
      });
    }
  }

  private async registerAssets(assets: AssetElement[]): Promise<void> {
    console.log(
      "-- AssetService: registerAssets started with assets count:",
      assets.length
    );
    assets.forEach((asset) => {
      const assetName = asset.assetName.trim();
      let newAssetInfo: AssetInfo;

      console.log(`-- AssetService: Processing asset: ${assetName}`, asset);

      switch (asset.assetType) {
        case "spine":
          const spineUrl = asset.assetUrl as {
            atlasUrl: string;
            skeletonUrl: string;
            skeletonType?: "binary" | "json";
          };
          console.log(
            `-- AssetService: Spine URL object for ${assetName}:`,
            spineUrl
          );
          newAssetInfo = {
            type: "spine",
            atlasUrl: spineUrl.atlasUrl,
            skeletonUrl: spineUrl.skeletonUrl,
            skeletonType: spineUrl.skeletonType || "json",
          } as SpineAssetInfo;
          console.log(
            `-- AssetService: Registering spine asset ${assetName}:`,
            newAssetInfo
          );
          break;
        case "video":
          newAssetInfo = {
            type: "video",
            url: asset.assetUrl as string,
          } as VideoAssetInfo;
          break;
        case "particle":
          newAssetInfo = {
            type: "particle",
            url: asset.assetUrl as string,
            textureName: assetName,
          } as ParticleAssetInfo;
          break;
        case "image":
        default:
          newAssetInfo = {
            type: "image",
            url: asset.assetUrl as string,
          } as ImageAssetInfo;
          break;
      }
      if (asset.pivot_override) {
        console.log(
          `-- AssetService: Setting pivot_override for ${assetName}:`,
          asset.pivot_override
        );
        newAssetInfo.pivot_override = asset.pivot_override;
      }

      this.assetsMap.set(assetName, newAssetInfo);
      console.log(
        `-- AssetService: Saved to assetsMap: ${assetName}`,
        this.assetsMap.get(assetName)
      );
    });
    console.log(
      "-- AssetService: registerAssets completed, assetsMap size:",
      this.assetsMap.size
    );
  }

  // === Display Methods ===

  public displayAsset(
    assetName: string,
    properties: AssetDisplayProperties
  ):
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Container {
    console.log(
      `-- AssetService: displayAsset called for ${assetName} with properties:`,
      properties
    );
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.log(`-- AssetService: Asset ${assetName} not found in assetsMap`);
      throw new Error(`Asset ${assetName} not found`);
    }
    console.log(`-- AssetService: Asset info for ${assetName}:`, assetInfo);

    if (assetInfo.type === "spine" && this.lastFailedSpines.has(assetName)) {
      const lastFailedTime = this.lastFailedSpines.get(assetName) || 0;
      const now = Date.now();
      console.log(
        `-- AssetService: Checking last failed time for spine ${assetName}: ${
          now - lastFailedTime
        }ms since last failure`
      );
      if (now - lastFailedTime > 5000) {
        console.log(
          `-- AssetService: Attempting to reload spine asset ${assetName} after previous failure`
        );
        this.loadSpineAsset(assetName, assetInfo as SpineAssetInfo).then(
          (result) => {
            if (result.success) {
              console.log(
                `-- AssetService: Successfully reloaded spine asset ${assetName}`
              );
              this.lastFailedSpines.delete(assetName);
            } else {
              console.log(
                `-- AssetService: Failed to reload spine asset ${assetName}: ${result.error}`
              );
              this.lastFailedSpines.set(assetName, now);
            }
          }
        );
      }
    }

    console.log(
      `-- AssetService: Cleaning up existing sprite for ${assetName}`
    );
    this.cleanupExistingSprite(assetInfo);
    console.log(`-- AssetService: Creating sprite for ${assetName}`);
    const sprite = this.createSprite(assetName, assetInfo, properties);
    console.log(`-- AssetService: Applying basic properties for ${assetName}`);
    const result = this.applyBasicProperties(sprite, properties, assetName);

    if (result instanceof Phaser.GameObjects.Sprite) {
      console.log(
        `-- AssetService: Applying advanced properties for ${assetName}`
      );
      this.applyAdvancedProperties(result, properties);
    }

    if (assetInfo.type === "spine" && !(result instanceof SpineGameObject)) {
      console.log(`-- AssetService: Marking spine ${assetName} as failed`);
      this.lastFailedSpines.set(assetName, Date.now());
    }

    this.successMessages.push(
      `displayAsset [Displayed ${assetName} (${assetInfo.type}) on scene]`
    );
    console.log(
      `-- AssetService: displayAsset completed for ${assetName}, result type:`,
      result.constructor.name
    );
    return result;
  }

  private cleanupExistingSprite(assetInfo: AssetInfo): void {
    console.log(
      `-- AssetService: cleanupExistingSprite called with assetInfo:`,
      assetInfo
    );
    if ("sprite" in assetInfo && assetInfo.sprite) {
      console.log(`-- AssetService: Destroying existing sprite for asset`);
      if (assetInfo.sprite instanceof Phaser.GameObjects.Video) {
        assetInfo.sprite.stop();
      }
      assetInfo.sprite.destroy();
    }
    console.log(`-- AssetService: cleanupExistingSprite completed`);
  }

  private createSprite(
    assetName: string,
    assetInfo: AssetInfo,
    properties: AssetDisplayProperties
  ): Phaser.GameObjects.Video | SpineGameObject | Phaser.GameObjects.Sprite {
    const x = properties.x ?? 0;
    const y = properties.y ?? 0;
    console.log(
      `-- AssetService: createSprite called for ${assetName} at (${x}, ${y}) with assetInfo:`,
      assetInfo
    );

    if (assetInfo.type === "video") {
      console.log(`-- AssetService: Creating video sprite for ${assetName}`);
      const video = this.scene.add.video(x, y, assetName);
      video.name = assetName;
      video.play(true);
      console.log(
        `-- AssetService: Video sprite created for ${assetName} at (${video.x}, ${video.y})`
      );
      return video;
    }
    if (assetInfo.type === "spine") {
      console.log(`-- AssetService: Creating spine sprite for ${assetName}`);
      try {
        const atlasKey = `${assetName}_atlas`;
        const skeletonKey = assetName;

        if (this.scene.cache.custom && this.scene.cache.custom.spine) {
          console.log(
            `-- AssetService: Checking cache for ${assetName}: atlas=${this.scene.cache.custom.spine.has(
              atlasKey
            )}, skeleton=${
              this.scene.cache.json.has(skeletonKey) ||
              this.scene.cache.binary.has(skeletonKey)
            }`
          );
        } else {
          console.log(
            `-- AssetService: Spine cache not available for ${assetName}`
          );
        }

        const spine = this.scene.add.spine(
          x,
          y,
          assetName,
          `${assetName}_atlas`
        );
        spine.name = assetName;
        console.log(
          `-- AssetService: Creating spine for ${assetName} with atlas ${assetName}Atlas`
        );
        console.log(
          `-- AssetService: Spine object created for ${assetName}:`,
          spine
        );
        console.log(
          `-- AssetService: Has skeleton for ${assetName}?`,
          !!spine.skeleton
        );

        if (spine.skeleton) {
          console.log(
            `-- AssetService: Has skeleton.data for ${assetName}?`,
            !!spine.skeleton.data
          );
        }

        if (spine?.skeleton?.data?.animations?.length > 0) {
          console.log(
            `-- AssetService: Animations available for ${assetName}:`,
            spine.skeleton.data.animations.map((a) => a.name)
          );
          spine.animationState.setAnimation(
            0,
            spine.skeleton.data.animations[2].name,
            true
          );
          console.log(
            `-- AssetService: Set animation for ${assetName} to ${spine.skeleton.data.animations[2].name}`
          );
        } else {
          console.error(
            `-- AssetService: No animations found or animations array is empty for ${assetName}`
          );
        }

        console.log(
          `-- AssetService: Spine sprite created for ${assetName} at (${spine.x}, ${spine.y})`
        );
        return spine;
      } catch (error) {
        console.error(
          `-- AssetService: Error creating spine object for ${assetName}:`,
          error
        );
        try {
          const placeholder = this.scene.add.sprite(x, y, "error_placeholder");
          placeholder.name = assetName;
          console.log(
            `-- AssetService: Placeholder sprite created for ${assetName} at (${placeholder.x}, ${placeholder.y})`
          );
          return placeholder;
        } catch (e) {
          console.error(
            `-- AssetService: Could not create error placeholder sprite for ${assetName}:`,
            e
          );
          const emptySprite = this.scene.add.sprite(x, y, "");
          emptySprite.name = assetName;
          console.log(
            `-- AssetService: Empty sprite created for ${assetName} at (${emptySprite.x}, ${emptySprite.y})`
          );
          return emptySprite;
        }
      }
    }

    console.log(
      `-- AssetService: Creating image/particle sprite for ${assetName}`
    );
    const sprite = this.scene.add.sprite(x, y, assetName);
    sprite.name = assetName;
    console.log(
      `-- AssetService: Sprite created for ${assetName} at (${sprite.x}, ${sprite.y})`
    );
    return sprite;
  }

  private applyBasicProperties(
    sprite:
      | Phaser.GameObjects.Video
      | SpineGameObject
      | Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties,
    assetName: string
  ): Phaser.GameObjects.Sprite | Phaser.GameObjects.Video | SpineGameObject {
    console.log(
      `miriAssetService: applyBasicProperties called for ${assetName} with properties:`,
      properties
    );
    const assetInfo = this.assetsMap.get(assetName);
    console.log(`miriAssetService: Asset info for ${assetName}:`, assetInfo);

    sprite.setOrigin(0.5, 0.5);
    sprite.setPosition(properties.x ?? 0, properties.y ?? 0);
    sprite.setAlpha(properties.alpha ?? 1);
    sprite.setVisible(true);

    if (properties.scale !== undefined) {
      sprite.setScale(properties.scale);
      console.log(
        `miriAssetService: Set scale for ${assetName} to ${properties.scale}`
      );
    }
    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
      console.log(
        `miriAssetService: Set rotation for ${assetName} to ${properties.rotation}`
      );
    }
    if (
      properties.tint !== undefined &&
      sprite instanceof Phaser.GameObjects.Sprite
    ) {
      sprite.setTint(properties.tint);
      console.log(
        `miriAssetService: Set tint for ${assetName} to ${properties.tint}`
      );
    }

    // הוספה לסצנה עם בדיקה מפורטת
    this.scene.add.existing(sprite);
    sprite.setPosition(properties.x ?? 0, properties.y ?? 0); // חיזוק המיקום
    console.log(
      `miriAssetService: Added sprite for ${assetName} to scene at (${
        properties.x ?? 0
      }, ${properties.y ?? 0})`
    );
    console.log(
      `miriAssetService: Sprite position after add: (${sprite.x}, ${sprite.y}), visible: ${sprite.visible}`
    );
    console.log(
      `miriAssetService: Sprite displayList:`,
      sprite.displayList ? "Exists" : "Null"
    );

    console.log(
      `miriAssetService: applyBasicProperties completed for ${assetName}, returning type:`,
      sprite.constructor.name
    );
    return sprite;
  }

  private applyAdvancedProperties(
    sprite: Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    console.log(
      `-- AssetService: applyAdvancedProperties called for sprite with properties:`,
      properties
    );
    if (properties.ratio) {
      this.applyAspectRatio(sprite, properties);
    }

    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
      console.log(
        `-- AssetService: Set rotation for sprite to ${properties.rotation}`
      );
    }

    if (properties.tint !== undefined) {
      sprite.setTint(properties.tint);
      console.log(`-- AssetService: Set tint for sprite to ${properties.tint}`);
    }

    if (properties.pivot) {
      sprite.setOrigin(properties.pivot.x, properties.pivot.y);
      console.log(
        `-- AssetService: Set pivot for sprite to (${properties.pivot.x}, ${properties.pivot.y})`
      );
    }
    console.log(`-- AssetService: applyAdvancedProperties completed`);
  }

  private applyAspectRatio(
    sprite: Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    console.log(
      `-- AssetService: applyAspectRatio called for sprite with properties:`,
      properties
    );
    if (!properties.ratio) return;

    const texture = sprite.texture;
    const sourceImage = texture.getSourceImage();
    const targetRatio = properties.ratio.width / properties.ratio.height;
    const currentRatio = sourceImage.width / sourceImage.height;
    const scale = properties.scale ?? 1;

    if (targetRatio > currentRatio) {
      sprite.setScale(scale, scale * (currentRatio / targetRatio));
      console.log(
        `-- AssetService: Adjusted scale for aspect ratio (target > current): (${scale}, ${
          scale * (currentRatio / targetRatio)
        })`
      );
    } else {
      sprite.setScale(scale * (targetRatio / currentRatio), scale);
      console.log(
        `-- AssetService: Adjusted scale for aspect ratio (target <= current): (${
          scale * (targetRatio / currentRatio)
        }, ${scale})`
      );
    }
    console.log(`-- AssetService: applyAspectRatio completed`);
  }

  // === Cleanup Methods ===
  public hideAllAssets(): void {
    console.log("-- AssetService: hideAllAssets called");
    for (const [assetName, assetInfo] of this.assetsMap.entries()) {
      console.log(`-- AssetService: Hiding asset ${assetName}`);
      this.cleanupExistingSprite(assetInfo);
      this.resetAssetInfo(assetName, assetInfo);
    }
    console.log("-- AssetService: hideAllAssets completed");
  }

  private resetAssetInfo(assetName: string, assetInfo: AssetInfo): void {
    console.log(`-- AssetService: resetAssetInfo called for ${assetName}`);
    let newAssetInfo: AssetInfo;

    switch (assetInfo.type) {
      case "video":
        newAssetInfo = { type: "video", url: assetInfo.url } as VideoAssetInfo;
        break;
      case "particle":
        newAssetInfo = {
          type: "particle",
          url: assetInfo.url,
          textureName: (assetInfo as ParticleAssetInfo).textureName,
        } as ParticleAssetInfo;
        break;
      case "image":
      default:
        newAssetInfo = { type: "image", url: assetInfo.url } as ImageAssetInfo;
        break;
    }

    this.assetsMap.set(assetName, newAssetInfo);
    console.log(
      `-- AssetService: resetAssetInfo updated ${assetName} with new info:`,
      newAssetInfo
    );
  }

  // === Asset Loading Methods ===
  async loadAsset(
    assetName: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`-- AssetService: loadAsset called for ${assetName}`);
    const assetInfo = this.getAssetsMap().get(assetName);
    if (!assetInfo) {
      console.log(`-- AssetService: Asset ${assetName} not found in assetsMap`);
      return { success: false, error: `Asset ${assetName} not found` };
    }
    console.log(
      `-- AssetService: Starting to load asset: ${assetName} (type: ${assetInfo.type})`
    );

    if (this.isAssetLoaded(assetName)) {
      console.log(`-- AssetService: Asset ${assetName} already loaded`);
      return { success: true };
    }

    switch (assetInfo.type) {
      case "video":
        console.log(
          `-- AssetService: Loading video with URL: ${assetInfo.url}`
        );
        return this.loadVideoAsset(assetName, assetInfo as VideoAssetInfo);
      case "spine":
        const spineInfo = assetInfo as SpineAssetInfo;
        console.log(
          `-- AssetService: Loading spine with atlas: ${spineInfo.atlasUrl}, skeleton: ${spineInfo.skeletonUrl}`
        );
        if (!spineInfo.atlasUrl || !spineInfo.skeletonUrl) {
          console.error(
            `-- AssetService: Spine asset ${assetName} missing atlasUrl or skeletonUrl`
          );
          return { success: false, error: `Missing Spine URLs` };
        }
        return this.loadSpineAsset(assetName, spineInfo);
      case "particle":
        console.log(
          `-- AssetService: Loading particle with URL: ${assetInfo.url}`
        );
        return this.loadParticleAsset(
          assetName,
          assetInfo as ParticleAssetInfo
        );
      case "image":
        console.log(
          `-- AssetService: Loading image with URL: ${assetInfo.url}`
        );
        return this.loadImageAsset(assetName, assetInfo as ImageAssetInfo);
      default:
        console.error(
          `-- AssetService: Unsupported asset type for ${assetName}: `
        );
        return {
          success: false,
          error: `Unsupported asset type: ${assetInfo}`,
        };
    }
  }

  private async loadParticleAsset(
    assetName: string,
    assetInfo: ParticleAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`-- AssetService: loadParticleAsset called for ${assetName}`);
    return new Promise((resolve) => {
      const textureKey = assetName;
      if (this.scene.textures.exists(textureKey)) {
        console.log(
          `-- AssetService: Texture ${textureKey} already exists for ${assetName}`
        );
        this.loadedAssets.add(assetName);
        this.assetsMap.set(assetName, {
          ...assetInfo,
          textureName: textureKey,
        });
        this.successMessages.push(
          `loadParticleAsset [Loaded particle ${assetName} successfully]`
        );
        console.log(
          `-- AssetService: Particle ${assetName} loaded successfully from existing texture`
        );
        resolve({ success: true });
        return;
      }

      console.log(
        `-- AssetService: Loading particle texture for ${assetName} from URL: ${assetInfo.url}`
      );
      this.scene.load.image(textureKey, assetInfo.url);
      this.scene.load.once("complete", () => {
        console.log(
          `-- AssetService: Particle texture ${textureKey} loaded into cache for ${assetName}`
        );
        this.loadedAssets.add(assetName);
        const tempSprite = this.scene.add.sprite(0, 0, textureKey);
        tempSprite.setVisible(false);
        this.assetsMap.set(assetName, {
          ...assetInfo,
          textureName: textureKey,
          sprite: tempSprite,
        });
        this.successMessages.push(
          `loadParticleAsset [Loaded particle ${assetName} successfully]`
        );
        console.log(
          `-- AssetService: Particle ${assetName} loaded and sprite created at (0, 0)`
        );
        resolve({ success: true });
      });

      this.scene.load.once("loaderror", () => {
        console.log(
          `-- AssetService: Failed to load particle texture ${textureKey} for ${assetName}`
        );
        resolve({
          success: false,
          error: `Failed to load particle texture: ${textureKey}`,
        });
      });

      this.scene.load.start();
    });
  }

  private async loadImageAsset(
    assetName: string,
    assetInfo: ImageAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`-- AssetService: loadImageAsset called for ${assetName}`);
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        console.log(
          `-- AssetService: Image ${assetName} loaded successfully from URL: ${assetInfo.url}`
        );
        this.scene.load.image(assetName, assetInfo.url);
        this.scene.load.once("complete", () => {
          if (!this.scene.textures.exists(assetName)) {
            console.log(
              `-- AssetService: Texture for ${assetName} not added to cache despite load completion`
            );
            resolve({
              success: false,
              error: `Texture for '${assetName}' was not added to Phaser cache despite load completion`,
            });
            return;
          }
          this.loadedAssets.add(assetName);
          const sprite = this.scene.add.sprite(0, 0, assetName);
          sprite.setVisible(false);
          this.assetsMap.set(assetName, { ...assetInfo, sprite });
          this.successMessages.push(
            `loadImageAsset [Loaded image ${assetName} successfully]`
          );
          console.log(
            `-- AssetService: Image ${assetName} loaded and sprite created at (0, 0)`
          );
          resolve({ success: true });
        });

        this.scene.load.once("loaderror", (file: Phaser.Loader.File) => {
          console.log(
            `-- AssetService: Failed to load image ${assetName} into Phaser: ${file.url}`
          );
          resolve({
            success: false,
            error: `Failed to load image '${assetName}' into Phaser - ${file.url}`,
          });
        });

        this.scene.load.start();
      };

      img.onerror = () => {
        console.error(
          `-- AssetService: Image failed to load for ${assetName} at URL: ${assetInfo.url}`
        );
        this.scene.load.off("complete");
        resolve({
          success: false,
          error: `Invalid or inaccessible image URL for '${assetName}': '${assetInfo.url}'`,
        });
      };

      try {
        new URL(assetInfo.url, window.location.origin);
        console.log(
          `-- AssetService: URL for ${assetName} is valid: ${assetInfo.url}`
        );
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(
          `-- AssetService: Malformed URL for ${assetName}: ${assetInfo.url} - ${errorMsg}`
        );
        resolve({
          success: false,
          error: `Malformed URL for '${assetName}': '${assetInfo.url}' - ${errorMsg}`,
        });
        return;
      }

      img.src = assetInfo.url;
    });
  }

  private async loadSpineAsset(
    assetName: string,
    assetInfo: SpineAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`-- AssetService: loadSpineAsset called for ${assetName}`);
    return new Promise((resolve) => {
      console.log(
        `-- AssetService: Loading Spine asset: ${assetName} (${assetInfo.skeletonType} format)`
      );
      console.log(
        `-- AssetService: Atlas URL: ${assetInfo.atlasUrl}, Skeleton URL: ${assetInfo.skeletonUrl}`
      );

      if (!assetInfo.atlasUrl || !assetInfo.skeletonUrl) {
        console.error(`-- AssetService: Missing URLs for ${assetName}`);
        resolve({ success: false, error: `Missing Spine URLs` });
        return;
      }

      const atlasKey = `${assetName}_atlas`;
      const skeletonKey = assetName;

      this.scene.load.spineAtlas(atlasKey, assetInfo.atlasUrl);
      if (assetInfo.skeletonType === "binary") {
        this.scene.load.spineBinary(skeletonKey, assetInfo.skeletonUrl);
      } else {
        this.scene.load.spineJson(skeletonKey, assetInfo.skeletonUrl);
      }
      const textureName = assetInfo.atlasUrl.replace(".atlas", ".png");
      this.scene.load.image(`${atlasKey}_texture`, textureName);

      this.scene.load.once("complete", () => {
        console.log(
          `-- AssetService: Spine asset ${assetName} files loaded into cache`
        );
        try {
          this.loadedAssets.add(assetName);
          this.assetsMap.set(assetName, { ...assetInfo, sprite: undefined });
          console.log(
            `-- AssetService: Spine asset ${assetName} loaded successfully`
          );
          resolve({ success: true });
        } catch (error) {
          console.error(
            `-- AssetService: Error creating spine object for ${assetName}:`,
            error
          );
          resolve({
            success: false,
            error: `Failed to create Spine object: `,
          });
        }
      });

      this.scene.load.once("loaderror", (file: Phaser.Loader.File) => {
        console.error(
          `-- AssetService: Error loading spine asset ${assetName}: ${file.url}`
        );
        resolve({
          success: false,
          error: `Failed to load Spine asset ${assetName}: ${file.url}`,
        });
      });

      this.scene.load.start();
    });
  }

  private async loadVideoAsset(
    assetName: string,
    assetInfo: VideoAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`-- AssetService: loadVideoAsset called for ${assetName}`);
    const fileExtension = assetInfo.url.split(".").pop()?.toLowerCase();

    if (!["mp4", "webm"].includes(fileExtension || "")) {
      console.log(
        `-- AssetService: Unsupported video format for ${assetName}: ${fileExtension}`
      );
      return {
        success: false,
        error: `Unsupported video format: ${fileExtension}`,
      };
    }

    return new Promise((resolve) => {
      console.log(
        `-- AssetService: Fetching video URL for ${assetName}: ${assetInfo.url}`
      );
      fetch(assetInfo.url)
        .then((response) => {
          if (!response.ok) {
            console.log(
              `-- AssetService: HTTP error fetching video ${assetName}: ${response.status}`
            );
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          this.scene.load.video(assetName, assetInfo.url);
          this.scene.load.once("complete", () => {
            console.log(
              `-- AssetService: Video ${assetName} loaded into cache`
            );
            this.loadedAssets.add(assetName);
            const video = this.scene.add.video(0, 0, assetName);
            video.setVisible(false);
            this.assetsMap.set(assetName, { ...assetInfo, sprite: video });
            console.log(
              `-- AssetService: Video sprite created for ${assetName} at (0, 0)`
            );
            resolve({ success: true });
          });

          this.scene.load.once("loaderror", () => {
            console.log(
              `-- AssetService: Failed to load video ${assetName} into Phaser`
            );
            resolve({
              success: false,
              error: `Failed to load video: ${assetName}`,
            });
          });

          this.scene.load.start();
        })
        .catch((error) => {
          console.log(
            `-- AssetService: Failed to fetch video ${assetName}:`,
            error
          );
          resolve({
            success: false,
            error: `Failed to fetch video: ${assetName}`,
          });
        });
    });
  }

  private async loadAssets(assets: AssetElement[]): Promise<
    {
      assetName: string;
      success: boolean;
      error?: string;
    }[]
  > {
    console.log(
      "-- AssetService: loadAssets started with assets count:",
      assets.length
    );
    const loadPromises = assets.map(async (asset) => {
      console.log(`-- AssetService: Loading asset ${asset.assetName}`);
      const result = await this.loadAsset(asset.assetName);
      console.log(
        `-- AssetService: Load result for ${asset.assetName}:`,
        result
      );
      return {
        assetName: asset.assetName,
        success: result.success,
        error: result.error,
      };
    });

    const results = await Promise.all(loadPromises);
    const successfulAssets = results.filter((result) => result.success);
    const failedAssets = results.filter((result) => !result.success);

    console.log(
      "-- AssetService: Load results - Successful:",
      successfulAssets.length,
      "Failed:",
      failedAssets.length
    );
    for (const result of results) {
      if (result.success) {
        const assetInfo = this.assetsMap.get(result.assetName);
        if (!assetInfo) {
          console.error(
            `-- AssetService: Asset ${result.assetName} not found in assetsMap after loading`
          );
          result.success = false;
          result.error = "Asset info missing after loading";
          continue;
        }

        let assetExists = false;
        switch (assetInfo.type) {
          case "video":
            assetExists =
              !!assetInfo.sprite &&
              assetInfo.sprite instanceof Phaser.GameObjects.Video;
            console.log(
              `-- AssetService: Video ${result.assetName} reported as successful. Does video object exist? ${assetExists}`
            );
            break;
          case "image":
          case "particle":
            assetExists = this.scene.textures.exists(result.assetName);
            console.log(
              `-- AssetService: Asset ${result.assetName} (type: ${assetInfo.type}) reported as successful. Does texture exist? ${assetExists}`
            );
            break;
          case "spine":
            assetExists =
              !!assetInfo.sprite &&
              "skeleton" in assetInfo.sprite &&
              ("state" in assetInfo.sprite ||
                "animationState" in assetInfo.sprite);
            console.log(
              `-- AssetService: Spine ${result.assetName} reported as successful. Does spine object exist? ${assetExists}`
            );
            break;
          default:
            console.warn(
              `-- AssetService: Unknown asset type for ${result.assetName}: ${assetInfo}`
            );
            assetExists = true;
        }

        if (!assetExists && assetInfo.type != "spine") {
          console.error(
            `-- AssetService: Asset ${result.assetName} reported success but asset verification failed!`
          );
          result.success = false;
          result.error = "Asset verification failed after loading";
        }
      }
    }

    if (failedAssets.length > 0) {
      console.error(
        "-- AssetService: Failed to load assets:",
        failedAssets.map((fa) => `${fa.assetName}: ${fa.error}`)
      );
    }

    if (successfulAssets.length === 0) {
      console.log("-- AssetService: No assets could be loaded");
      throw new Error("No assets could be loaded");
    }

    console.log("-- AssetService: loadAssets completed with results:", results);
    return results;
  }

  public isAssetLoaded(assetName: string): boolean {
    console.log(`-- AssetService: isAssetLoaded called for ${assetName}`);
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.log(`-- AssetService: Asset ${assetName} not found in assetsMap`);
      return false;
    }

    const isLoaded = this.loadedAssets.has(assetName);
    console.log(
      `-- AssetService: Asset ${assetName} loaded in loadedAssets? ${isLoaded}`
    );

    if (assetInfo.type === "image") {
      const exists =
        isLoaded &&
        (assetInfo as ImageAssetInfo).sprite instanceof
          Phaser.GameObjects.Sprite;
      console.log(
        `-- AssetService: Image ${assetName} exists as sprite? ${exists}`
      );
      return exists;
    }
    if (assetInfo.type === "video") {
      const exists =
        isLoaded &&
        (assetInfo as VideoAssetInfo).sprite instanceof
          Phaser.GameObjects.Video;
      console.log(
        `-- AssetService: Video ${assetName} exists as video? ${exists}`
      );
      return exists;
    }
    if (assetInfo.type === "particle") {
      const exists = isLoaded && !!(assetInfo as ParticleAssetInfo).textureName;
      console.log(
        `-- AssetService: Particle ${assetName} has textureName? ${exists}`
      );
      return exists;
    }

    if (assetInfo.type === "spine") {
      const exists =
        isLoaded &&
        "sprite" in assetInfo &&
        assetInfo.sprite instanceof Phaser.GameObjects.GameObject;
      console.log(
        `-- AssetService: Spine ${assetName} exists as game object? ${exists}`
      );
      return exists;
    }
    console.log(`-- AssetService: Default check for ${assetName}: ${isLoaded}`);
    return false;
  }

  private validateAssetStructure(json: AssetJson): string[] {
    console.log("-- AssetService: validateAssetStructure started");
    const errors: string[] = [];

    if (!json.assets || !Array.isArray(json.assets)) {
      console.log(
        "-- AssetService: Invalid JSON structure - 'assets' key is missing or not an array"
      );
      errors.push(
        "Invalid JSON structure - 'assets' key is missing or not an array"
      );
      return errors;
    }

    console.log(
      "-- AssetService: Validating assets structure, count:",
      json.assets.length
    );
    json.assets.forEach((asset, index) => {
      const assetPrefix = `Asset #${index + 1} (${
        asset.assetName || "unnamed"
      })`;
      console.log(`-- AssetService: Validating ${assetPrefix}`);

      if (
        !asset.assetName ||
        typeof asset.assetName !== "string" ||
        asset.assetName.trim() === ""
      ) {
        console.log(
          `-- AssetService: ${assetPrefix} - 'assetName' validation failed`
        );
        errors.push(
          `${assetPrefix}: 'assetName' is missing, not a string, or empty`
        );
      }

      const validTypes = ["image", "video", "particle", "spine"];
      if (!asset.assetType || !validTypes.includes(asset.assetType)) {
        console.log(
          `-- AssetService: ${assetPrefix} - 'assetType' validation failed`
        );
        errors.push(
          `${assetPrefix}: 'assetType' is missing or invalid, must be one of ${validTypes.join(
            ", "
          )}`
        );
      }

      if (!asset.assetUrl) {
        console.log(`-- AssetService: ${assetPrefix} - 'assetUrl' is missing`);
        errors.push(`${assetPrefix}: 'assetUrl' is missing`);
      } else if (asset.assetType === "spine") {
        if (typeof asset.assetUrl !== "object" || asset.assetUrl === null) {
          console.log(
            `-- AssetService: ${assetPrefix} - Spine 'assetUrl' must be an object`
          );
          errors.push(
            `${assetPrefix}: For spine assets, 'assetUrl' must be an object with skeletonUrl and atlasUrl properties`
          );
        } else {
          const spineUrl = asset.assetUrl as any;

          if (!spineUrl.skeletonUrl) {
            console.log(
              `-- AssetService: ${assetPrefix} - Missing 'skeletonUrl'`
            );
            errors.push(
              `${assetPrefix}: Missing 'skeletonUrl' for spine asset`
            );
          } else if (typeof spineUrl.skeletonUrl !== "string") {
            console.log(
              `-- AssetService: ${assetPrefix} - 'skeletonUrl' must be a string`
            );
            errors.push(`${assetPrefix}: 'skeletonUrl' must be a string`);
          } else {
            const validSkeletonExts = [".json", ".skel"];
            const hasValidSkeletonExt = validSkeletonExts.some((ext) =>
              spineUrl.skeletonUrl.toLowerCase().endsWith(ext)
            );
            if (!hasValidSkeletonExt) {
              console.log(
                `-- AssetService: ${assetPrefix} - Invalid 'skeletonUrl' extension`
              );
              errors.push(
                `${assetPrefix}: 'skeletonUrl' must end with .json or .skel: '${spineUrl.skeletonUrl}'`
              );
            }
          }

          if (!spineUrl.atlasUrl) {
            console.log(`-- AssetService: ${assetPrefix} - Missing 'atlasUrl'`);
            errors.push(`${assetPrefix}: Missing 'atlasUrl' for spine asset`);
          } else if (typeof spineUrl.atlasUrl !== "string") {
            console.log(
              `-- AssetService: ${assetPrefix} - 'atlasUrl' must be a string`
            );
            errors.push(`${assetPrefix}: 'atlasUrl' must be a string`);
          } else if (!spineUrl.atlasUrl.toLowerCase().endsWith(".atlas")) {
            console.log(
              `-- AssetService: ${assetPrefix} - Invalid 'atlasUrl' extension`
            );
            errors.push(
              `${assetPrefix}: 'atlasUrl' must end with .atlas: '${spineUrl.atlasUrl}'`
            );
          }
        }
      } else {
        if (typeof asset.assetUrl !== "string") {
          console.log(
            `-- AssetService: ${assetPrefix} - 'assetUrl' must be a string`
          );
          errors.push(
            `${assetPrefix}: 'assetUrl' must be a string, got ${typeof asset.assetUrl}`
          );
        } else {
          const url = asset.assetUrl.trim();
          if (!url) {
            console.log(
              `-- AssetService: ${assetPrefix} - 'assetUrl' is empty`
            );
            errors.push(`${assetPrefix}: 'assetUrl' is empty`);
          } else {
            const urlRegex = /^[a-zA-Z0-9\/._-]*$/;
            if (!urlRegex.test(url)) {
              console.log(
                `-- AssetService: ${assetPrefix} - 'assetUrl' contains invalid characters`
              );
              errors.push(
                `${assetPrefix}: 'assetUrl' contains invalid characters: '${url}'`
              );
            }

            const validExtensions = [
              "png",
              "jpg",
              "jpeg",
              "webp",
              "mp4",
              "webm",
            ];
            const hasValidExtension = validExtensions.some((ext) =>
              url.toLowerCase().endsWith(`.${ext}`)
            );
            if (!hasValidExtension) {
              console.log(
                `-- AssetService: ${assetPrefix} - Invalid 'assetUrl' extension`
              );
              errors.push(
                `${assetPrefix}: 'assetUrl' does not end with a supported file extension: '${url}'`
              );
            }
          }
        }
      }
    });

    console.log(
      "-- AssetService: validateAssetStructure completed with errors:",
      errors
    );
    return errors;
  }

  private async checkAssetsExistence(
    assets: AssetElement[]
  ): Promise<string[]> {
    console.log(
      "-- AssetService: checkAssetsExistence started with assets count:",
      assets.length
    );
    const errors: string[] = [];

    for (const asset of assets) {
      const assetPrefix = `Asset '${asset.assetName}'`;
      let urlToCheck = asset.assetUrl as string;

      if (typeof urlToCheck !== "string" || !urlToCheck.trim()) {
        console.log(
          `-- AssetService: ${assetPrefix} - Skipping due to invalid or empty URL`
        );
        continue;
      }

      try {
        console.log(
          `-- AssetService: ${assetPrefix}: Checking existence of URL '${urlToCheck}'`
        );
        const response = await fetch(urlToCheck, { method: "HEAD" });

        if (!response.ok) {
          console.log(
            `-- AssetService: ${assetPrefix} - URL inaccessible, status: ${response.status}`
          );
          errors.push(
            `${assetPrefix}: URL '${urlToCheck}' is inaccessible (HTTP Status: ${response.status} - ${response.statusText})`
          );
        } else {
          console.log(
            `-- AssetService: ${assetPrefix} - URL '${urlToCheck}' exists and is accessible`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(
          `-- AssetService: ${assetPrefix} - Failed to check URL '${urlToCheck}': ${errorMsg}`
        );
        if (errorMsg.includes("Failed to fetch")) {
          errors.push(
            `${assetPrefix}: URL '${urlToCheck}' is invalid or unreachable - possible malformed URL or network issue`
          );
        } else {
          errors.push(
            `${assetPrefix}: Failed to check URL '${urlToCheck}' - ${errorMsg}`
          );
        }
      }
    }

    console.log(
      "-- AssetService: checkAssetsExistence completed with errors:",
      errors
    );
    return errors;
  }

  private displayLoadResults(
    results: { assetName: string; success: boolean; error?: string }[]
  ): void {
    console.log(
      "-- AssetService: displayLoadResults called with results:",
      results
    );
    const successfulAssets = results.filter((result) => result.success);
    const failedAssets = results.filter((result) => !result.success);
    const messages: any[] = [];

    console.log(
      `-- AssetService: Load summary - Successful: ${successfulAssets.length}, Failed: ${failedAssets.length}`
    );
    messages.push(
      createInfoMessage(
        `Asset Loading Summary: ${successfulAssets.length} succeeded, ${failedAssets.length} failed`
      )
    );

    if (successfulAssets.length > 0) {
      messages.push(createSuccessMessage("Successfully Loaded Assets:"));
      successfulAssets.forEach((asset, index) => {
        messages.push(
          createInfoMessage(
            `${index + 1}. '${asset.assetName}' - Loaded successfully`
          )
        );
      });
    }

    if (failedAssets.length > 0) {
      messages.push(createErrorMessage("Failed to Load Assets:"));
      failedAssets.forEach((asset, index) => {
        messages.push(
          createErrorMessage(
            `${index + 1}. '${asset.assetName}' - Error: ${
              asset.error || "Unknown error"
            }`
          )
        );
      });
    }

    showMessage({
      isOpen: true,
      title: "Asset Loading Results",
      messages:
        messages.length > 1
          ? messages
          : [createInfoMessage("No assets processed.")],
      autoClose: failedAssets.length === 0,
      autoCloseTime: 7000,
    });
    console.log("-- AssetService: displayLoadResults completed");
  }
}
