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
  }

  // === Asset Management Methods ===
  public getAssetsMap(): Map<string, AssetInfo> {
    return new Map(this.assetsMap);
  }

  public getAssetInfo(assetName: string): AssetInfo | undefined {
    const assetInfo = this.assetsMap.get(assetName);
    console.log(
      `AssetService: getAssetInfo result for ${assetName}:`,
      assetInfo
    );
    return assetInfo;
  }

  public setAssetInfo(assetName: string, assetInfo: AssetInfo): void {
    this.assetsMap.set(assetName, assetInfo);
    this.successMessages.push(
      `setAssetInfo [Updates asset info in the map for ${assetName}]`
    );
  }

  // === Asset Loading Methods ===
  public async handleAssetsJson(file: File): Promise<void> {
    try {
      const fileContent = await file.text();

      const json = JSON.parse(fileContent) as AssetJson;

      const structureErrors = this.validateAssetStructure(json);
      if (structureErrors.length > 0) {
        console.log(
          "AssetService: handleAssetsJson validation errors:",
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
        showMessage({
          isOpen: true,
          title: `Asset Accessibility Issues (${existenceErrors.length})`,
          messages: existenceErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      await this.registerAssets(json.assets);
      const loadResults = await this.loadAssets(json.assets);

      this.displayLoadResults(loadResults);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during asset processing";
      showMessage({
        isOpen: true,
        title: "Asset Processing Error",
        messages: [createErrorMessage(errorMessage)],
        autoClose: false,
      });
    }
  }

  private async registerAssets(assets: AssetElement[]): Promise<void> {
    assets.forEach((asset) => {
      const assetName = asset.assetName.trim();
      let newAssetInfo: AssetInfo;

      switch (asset.assetType) {
        case "spine":
          const spineUrl = asset.assetUrl as {
            atlasUrl: string;
            skeletonUrl: string;
            skeletonType?: "binary" | "json";
          };
          newAssetInfo = {
            type: "spine",
            atlasUrl: spineUrl.atlasUrl,
            skeletonUrl: spineUrl.skeletonUrl,
            skeletonType: spineUrl.skeletonType || "json",
          } as SpineAssetInfo;

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
        newAssetInfo.pivot_override = asset.pivot_override;
      }
      this.assetsMap.set(assetName, newAssetInfo);
    });
  }

  // === Display Methods ===

  public displayAsset(
    assetName: string,
    properties: AssetDisplayProperties
  ): Phaser.GameObjects.Video | SpineGameObject | Phaser.GameObjects.Sprite {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      throw new Error(`Asset ${assetName} not found`);
    }

    if (assetInfo.type === "spine" && this.lastFailedSpines.has(assetName)) {
      const lastFailedTime = this.lastFailedSpines.get(assetName) || 0;
      const now = Date.now();

      if (now - lastFailedTime > 5000) {
        this.loadSpineAsset(assetName, assetInfo as SpineAssetInfo).then(
          (result) => {
            if (result.success) {
              this.lastFailedSpines.delete(assetName);
            } else {
              this.lastFailedSpines.set(assetName, now);
            }
          }
        );
      }
    }

    this.cleanupExistingSprite(assetInfo);
    const sprite = this.createSprite(assetName, assetInfo, properties);
    //pivo is beeing on the asset json and not getting its type from timeline as other properties
    properties.pivot = this.getAssetPivot(assetName);
    const result = this.applyBasicProperties(sprite, properties, assetName);

    if (result instanceof Phaser.GameObjects.Sprite) {
      this.applyAdvancedProperties(result, properties);
    }

    if (assetInfo.type === "spine" && !(result instanceof SpineGameObject)) {
      this.lastFailedSpines.set(assetName, Date.now());
    }

    this.successMessages.push(
      `displayAsset [Displayed ${assetName} (${assetInfo.type}) on scene]`
    );

    return result;
  }

  private cleanupExistingSprite(assetInfo: AssetInfo): void {
    if ("sprite" in assetInfo && assetInfo.sprite) {
      if (assetInfo.sprite instanceof Phaser.GameObjects.Video) {
        assetInfo.sprite.stop();
      }
      assetInfo.sprite.destroy();
    }
  }

  private createSprite(
    assetName: string,
    assetInfo: AssetInfo,
    properties: AssetDisplayProperties
  ): Phaser.GameObjects.Video | SpineGameObject | Phaser.GameObjects.Sprite {
    const x = properties.x ?? 0;
    const y = properties.y ?? 0;

    if (assetInfo.type === "video") {
      const video = this.scene.add.video(x, y, assetName);
      video.name = assetName;
      video.play(true);

      return video;
    }
    if (assetInfo.type === "spine") {
      try {
        const atlasKey = `${assetName}_atlas`;
        const skeletonKey = assetName;

        // if (this.scene.cache.custom && this.scene.cache.custom.spine) {
        //   console.log(
        //     `AssetService: Checking cache for ${assetName}: atlas=${this.scene.cache.custom.spine.has(
        //       atlasKey
        //     )}, skeleton=${
        //       this.scene.cache.json.has(skeletonKey) ||
        //       this.scene.cache.binary.has(skeletonKey)
        //     }`
        //   );
        // }

        const spine = this.scene.add.spine(
          x,
          y,
          assetName,
          `${assetName}_atlas`
        );
        spine.name = assetName;

        if (spine?.skeleton?.data?.animations?.length > 0) {
          spine.animationState.setAnimation(
            0,
            spine.skeleton.data.animations[2].name,
            true
          );
        } else {
          console.error(
            `AssetService: No animations found or animations array is empty for ${assetName}`
          );
        }
        return spine;
      } catch (error) {
        console.error(
          `AssetService: Error creating spine object for ${assetName}:`,
          error
        );
        try {
          const placeholder = this.scene.add.sprite(x, y, "error_placeholder");
          placeholder.name = assetName;

          return placeholder;
        } catch (e) {
          console.error(
            `AssetService: Could not create error placeholder sprite for ${assetName}:`,
            e
          );
          const emptySprite = this.scene.add.sprite(x, y, "");
          emptySprite.name = assetName;

          return emptySprite;
        }
      }
    }

    const sprite = this.scene.add.sprite(x, y, assetName);
    sprite.name = assetName;

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
    const assetInfo = this.assetsMap.get(assetName);

    sprite.setAlpha(properties.alpha ?? 1);
    sprite.setVisible(true);

    if (properties.scale !== undefined) {
      sprite.setScale(properties.scale);
    }
    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }
    if (
      properties.tint !== undefined &&
      sprite instanceof Phaser.GameObjects.Sprite
    ) {
      sprite.setTint(properties.tint);
    }

    this.scene.add.existing(sprite);
    return sprite;
  }

  public applyAdvancedProperties(
    sprite: Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    if (properties.ratio) {
      this.applyAspectRatio(sprite, properties);
    }

    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }

    if (properties.tint !== undefined) {
      sprite.setTint(properties.tint);
    }

    sprite.setOrigin(properties.pivot?.x ?? 0.5, properties.pivot?.y ?? 0.5); // נקודת העוגן במרכז האלמנט
    console.log(
      "@@@ Origin " +
        sprite.name +
        " " +
        properties.pivot?.x +
        " , " +
        properties.pivot?.y
    );
    console.log("@@@ position " + " " + properties.x + " , " + properties.y);
    console.log(
      "@@@ screen size " +
        " " +
        this.scene.scale.width +
        " , " +
        this.scene.scale.height
    );

    sprite.setPosition(
      properties.x ?? this.scene.scale.width / 2,
      properties.y ?? this.scene.scale.height / 2
    );

    const anchorExample = this.calculatePositionByLastResolution(
      properties.x ?? 1,
      properties.y ?? 1,
      1920,
      1080
    );

    console.log("@@ new anchor " + anchorExample.x + " , " + properties.y);
  }

  private calculatePositionByLastResolution(
    x: number,
    y: number,
    lastScreenWidth: number,
    lastScreenHeight: number
  ) {
    const relativeAnchor = this.getRelativePositionByResolution(
      x,
      y,
      lastScreenWidth,
      lastScreenHeight
    );

    console.log("@@ former relativeAnchor " + x + " , " + y);

    const position = {
      x: this.scene.scale.width / relativeAnchor.x,
      y: this.scene.scale.height / relativeAnchor.y,
    };
    return position;
  }

  private getRelativePositionByResolution(
    x: number, // pixal location
    y: number, // pixal location
    screenWidth: number, // pixal width
    screenHeight: number // pixal height
  ) {
    //calculate  relative location
    const relativeX = screenWidth / x;
    const relativeY = screenHeight / y;

    return { x: relativeX, y: relativeY };
  }

  private applyAspectRatio(
    sprite: Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    if (!properties.ratio) return;

    const texture = sprite.texture;
    const sourceImage = texture.getSourceImage();
    const targetRatio = properties.ratio.width / properties.ratio.height;
    const currentRatio = sourceImage.width / sourceImage.height;
    const scale = properties.scale ?? 1;

    if (targetRatio > currentRatio) {
      sprite.setScale(scale, scale * (currentRatio / targetRatio));
    } else {
      sprite.setScale(scale * (targetRatio / currentRatio), scale);
    }
  }

  // === Cleanup Methods ===
  public hideAllAssets(): void {
    for (const [assetName, assetInfo] of this.assetsMap.entries()) {
      this.cleanupExistingSprite(assetInfo);
      this.resetAssetInfo(assetName, assetInfo);
    }
  }

  private resetAssetInfo(assetName: string, assetInfo: AssetInfo): void {
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
  }

  // === Asset Loading Methods ===
  async loadAsset(
    assetName: string
  ): Promise<{ success: boolean; error?: string }> {
    const assetInfo = this.getAssetsMap().get(assetName);
    if (!assetInfo) {
      return { success: false, error: `Asset ${assetName} not found` };
    }

    if (this.isAssetLoaded(assetName)) {
      return { success: true };
    }

    switch (assetInfo.type) {
      case "video":
        return this.loadVideoAsset(assetName, assetInfo as VideoAssetInfo);
      case "spine":
        const spineInfo = assetInfo as SpineAssetInfo;

        if (!spineInfo.atlasUrl || !spineInfo.skeletonUrl) {
          return { success: false, error: `Missing Spine URLs` };
        }
        return this.loadSpineAsset(assetName, spineInfo);
      case "particle":
        return this.loadParticleAsset(
          assetName,
          assetInfo as ParticleAssetInfo
        );
      case "image":
        return this.loadImageAsset(assetName, assetInfo as ImageAssetInfo);
      default:
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
    return new Promise((resolve) => {
      const textureKey = assetName;
      if (this.scene.textures.exists(textureKey)) {
        this.loadedAssets.add(assetName);
        this.assetsMap.set(assetName, {
          ...assetInfo,
          textureName: textureKey,
        });
        this.successMessages.push(
          `loadParticleAsset [Loaded particle ${assetName} successfully]`
        );

        resolve({ success: true });
        return;
      }

      this.scene.load.image(textureKey, assetInfo.url);
      this.scene.load.once("complete", () => {
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

        resolve({ success: true });
      });

      this.scene.load.once("loaderror", () => {
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
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        this.scene.load.image(assetName, assetInfo.url);
        this.scene.load.once("complete", () => {
          if (!this.scene.textures.exists(assetName)) {
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

          resolve({ success: true });
        });

        this.scene.load.once("loaderror", (file: Phaser.Loader.File) => {
          resolve({
            success: false,
            error: `Failed to load image '${assetName}' into Phaser - ${file.url}`,
          });
        });

        this.scene.load.start();
      };

      img.onerror = () => {
        console.error(
          `AssetService: Image failed to load for ${assetName} at URL: ${assetInfo.url}`
        );
        this.scene.load.off("complete");
        resolve({
          success: false,
          error: `Invalid or inaccessible image URL for '${assetName}': '${assetInfo.url}'`,
        });
      };

      try {
        new URL(assetInfo.url, window.location.origin);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);

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
    return new Promise((resolve) => {
      if (!assetInfo.atlasUrl || !assetInfo.skeletonUrl) {
        console.error(`AssetService: Missing URLs for ${assetName}`);
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
        try {
          this.loadedAssets.add(assetName);
          this.assetsMap.set(assetName, { ...assetInfo, sprite: undefined });
          console.log(
            `AssetService: Spine asset ${assetName} loaded successfully`
          );
          resolve({ success: true });
        } catch (error) {
          console.error(
            `AssetService: Error creating spine object for ${assetName}:`,
            error
          );
          resolve({
            success: false,
            error: `Failed to create Spine object: `,
          });
        }
      });

      this.scene.load.once("loaderror", (file: Phaser.Loader.File) => {
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
    const fileExtension = assetInfo.url.split(".").pop()?.toLowerCase();

    if (!["mp4", "webm"].includes(fileExtension || "")) {
      return {
        success: false,
        error: `Unsupported video format: ${fileExtension}`,
      };
    }

    return new Promise((resolve) => {
      fetch(assetInfo.url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          this.scene.load.video(assetName, assetInfo.url);
          this.scene.load.once("complete", () => {
            this.loadedAssets.add(assetName);
            const video = this.scene.add.video(0, 0, assetName);
            video.setVisible(false);
            this.assetsMap.set(assetName, { ...assetInfo, sprite: video });

            resolve({ success: true });
          });

          this.scene.load.once("loaderror", () => {
            resolve({
              success: false,
              error: `Failed to load video: ${assetName}`,
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
    });
  }

  private async loadAssets(assets: AssetElement[]): Promise<
    {
      assetName: string;
      success: boolean;
      error?: string;
    }[]
  > {
    const loadPromises = assets.map(async (asset) => {
      const result = await this.loadAsset(asset.assetName);

      return {
        assetName: asset.assetName,
        success: result.success,
        error: result.error,
      };
    });

    const results = await Promise.all(loadPromises);
    const successfulAssets = results.filter((result) => result.success);
    const failedAssets = results.filter((result) => !result.success);

    for (const result of results) {
      if (result.success) {
        const assetInfo = this.assetsMap.get(result.assetName);
        if (!assetInfo) {
          console.error(
            `AssetService: Asset ${result.assetName} not found in assetsMap after loading`
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

            break;
          case "image":
          case "particle":
            assetExists = this.scene.textures.exists(result.assetName);

            break;
          case "spine":
            assetExists =
              !!assetInfo.sprite &&
              "skeleton" in assetInfo.sprite &&
              ("state" in assetInfo.sprite ||
                "animationState" in assetInfo.sprite);
            break;
          default:
            console.warn(
              `AssetService: Unknown asset type for ${result.assetName}: ${assetInfo}`
            );
            assetExists = true;
        }

        if (!assetExists && assetInfo.type != "spine") {
          console.error(
            `AssetService: Asset ${result.assetName} reported success but asset verification failed!`
          );
          result.success = false;
          result.error = "Asset verification failed after loading";
        }
      }
    }

    if (failedAssets.length > 0) {
      console.error(
        "AssetService: Failed to load assets:",
        failedAssets.map((fa) => `${fa.assetName}: ${fa.error}`)
      );
    }

    if (successfulAssets.length === 0) {
      console.log("AssetService: No assets could be loaded");
      throw new Error("No assets could be loaded");
    }

    console.log("AssetService: loadAssets completed with results:", results);
    return results;
  }

  public isAssetLoaded(assetName: string): boolean {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.log(`AssetService: Asset ${assetName} not found in assetsMap`);
      return false;
    }

    const isLoaded = this.loadedAssets.has(assetName);

    if (assetInfo.type === "image") {
      const exists =
        isLoaded &&
        (assetInfo as ImageAssetInfo).sprite instanceof
          Phaser.GameObjects.Sprite;
      return exists;
    }
    if (assetInfo.type === "video") {
      const exists =
        isLoaded &&
        (assetInfo as VideoAssetInfo).sprite instanceof
          Phaser.GameObjects.Video;
      return exists;
    }
    if (assetInfo.type === "particle") {
      const exists = isLoaded && !!(assetInfo as ParticleAssetInfo).textureName;
      return exists;
    }

    if (assetInfo.type === "spine") {
      const exists =
        isLoaded &&
        "sprite" in assetInfo &&
        assetInfo.sprite instanceof Phaser.GameObjects.GameObject;
      return exists;
    }
    return false;
  }

  private validateAssetStructure(json: AssetJson): string[] {
    const errors: string[] = [];

    if (!json.assets || !Array.isArray(json.assets)) {
      console.log(
        "AssetService: Invalid JSON structure - 'assets' key is missing or not an array"
      );
      errors.push(
        "Invalid JSON structure - 'assets' key is missing or not an array"
      );
      return errors;
    }

    json.assets.forEach((asset, index) => {
      const assetPrefix = `Asset #${index + 1} (${
        asset.assetName || "unnamed"
      })`;

      if (
        !asset.assetName ||
        typeof asset.assetName !== "string" ||
        asset.assetName.trim() === ""
      ) {
        console.log(
          `AssetService: ${assetPrefix} - 'assetName' validation failed`
        );
        errors.push(
          `${assetPrefix}: 'assetName' is missing, not a string, or empty`
        );
      }

      const validTypes = ["image", "video", "particle", "spine"];
      if (!asset.assetType || !validTypes.includes(asset.assetType)) {
        console.log(
          `AssetService: ${assetPrefix} - 'assetType' validation failed`
        );
        errors.push(
          `${assetPrefix}: 'assetType' is missing or invalid, must be one of ${validTypes.join(
            ", "
          )}`
        );
      }

      if (!asset.assetUrl) {
        console.log(`AssetService: ${assetPrefix} - 'assetUrl' is missing`);
        errors.push(`${assetPrefix}: 'assetUrl' is missing`);
      } else if (asset.assetType === "spine") {
        if (typeof asset.assetUrl !== "object" || asset.assetUrl === null) {
          errors.push(
            `${assetPrefix}: For spine assets, 'assetUrl' must be an object with skeletonUrl and atlasUrl properties`
          );
        } else {
          const spineUrl = asset.assetUrl as any;

          if (!spineUrl.skeletonUrl) {
            errors.push(
              `${assetPrefix}: Missing 'skeletonUrl' for spine asset`
            );
          } else if (typeof spineUrl.skeletonUrl !== "string") {
            errors.push(`${assetPrefix}: 'skeletonUrl' must be a string`);
          } else {
            const validSkeletonExts = [".json", ".skel"];
            const hasValidSkeletonExt = validSkeletonExts.some((ext) =>
              spineUrl.skeletonUrl.toLowerCase().endsWith(ext)
            );
            if (!hasValidSkeletonExt) {
              console.log(
                `AssetService: ${assetPrefix} - Invalid 'skeletonUrl' extension`
              );
              errors.push(
                `${assetPrefix}: 'skeletonUrl' must end with .json or .skel: '${spineUrl.skeletonUrl}'`
              );
            }
          }

          if (!spineUrl.atlasUrl) {
            console.log(`AssetService: ${assetPrefix} - Missing 'atlasUrl'`);
            errors.push(`${assetPrefix}: Missing 'atlasUrl' for spine asset`);
          } else if (typeof spineUrl.atlasUrl !== "string") {
            console.log(
              `AssetService: ${assetPrefix} - 'atlasUrl' must be a string`
            );
            errors.push(`${assetPrefix}: 'atlasUrl' must be a string`);
          } else if (!spineUrl.atlasUrl.toLowerCase().endsWith(".atlas")) {
            console.log(
              `AssetService: ${assetPrefix} - Invalid 'atlasUrl' extension`
            );
            errors.push(
              `${assetPrefix}: 'atlasUrl' must end with .atlas: '${spineUrl.atlasUrl}'`
            );
          }
        }
      } else {
        if (typeof asset.assetUrl !== "string") {
          console.log(
            `AssetService: ${assetPrefix} - 'assetUrl' must be a string`
          );
          errors.push(
            `${assetPrefix}: 'assetUrl' must be a string, got ${typeof asset.assetUrl}`
          );
        } else {
          const url = asset.assetUrl.trim();
          if (!url) {
            console.log(`AssetService: ${assetPrefix} - 'assetUrl' is empty`);
            errors.push(`${assetPrefix}: 'assetUrl' is empty`);
          } else {
            const urlRegex = /^[a-zA-Z0-9\/._-]*$/;
            if (!urlRegex.test(url)) {
              console.log(
                `AssetService: ${assetPrefix} - 'assetUrl' contains invalid characters`
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
                `AssetService: ${assetPrefix} - Invalid 'assetUrl' extension`
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
      "AssetService: validateAssetStructure completed with errors:",
      errors
    );
    return errors;
  }

  public getAssetPivot(assetName: string): { x: number; y: number } {
    const assetInfo = this.assetsMap.get(assetName);

    // אם הנכס לא נמצא, מחזירים ערכי ברירת מחדל
    if (!assetInfo) {
      console.warn(
        `AssetService: No asset found for ${assetName}, returning default pivot (0.5, 0.5)`
      );
      return { x: 0.5, y: 0.5 };
    }

    // בדיקה אם קיים pivot_override ב-assetInfo
    if (assetInfo.pivot_override) {
      const pivot = assetInfo.pivot_override;

      // וידוא שהערכים הם מספרים תקינים, אחרת שימוש בברירת מחדל
      const x = typeof pivot.x === "number" && !isNaN(pivot.x) ? pivot.x : 0.5;
      const y = typeof pivot.y === "number" && !isNaN(pivot.y) ? pivot.y : 0.5;

      console.log(`AssetService: Found pivot for ${assetName}: x=${x}, y=${y}`);
      return { x, y };
    }

    // אם אין pivot_override, מחזירים ערכי ברירת מחדל
    console.log(
      `AssetService: No pivot override for ${assetName}, using default (0.5, 0.5)`
    );
    return { x: 0.5, y: 0.5 };
  }

  private async checkAssetsExistence(
    assets: AssetElement[]
  ): Promise<string[]> {
    console.log(
      "AssetService: checkAssetsExistence started with assets count:",
      assets.length
    );
    const errors: string[] = [];

    for (const asset of assets) {
      const assetPrefix = `Asset '${asset.assetName}'`;
      let urlToCheck = asset.assetUrl as string;

      if (typeof urlToCheck !== "string" || !urlToCheck.trim()) {
        console.log(
          `-AssetService: ${assetPrefix} - Skipping due to invalid or empty URL`
        );
        continue;
      }

      try {
        const response = await fetch(urlToCheck, { method: "HEAD" });

        if (!response.ok) {
          console.log(
            `AssetService: ${assetPrefix} - URL inaccessible, status: ${response.status}`
          );
          errors.push(
            `${assetPrefix}: URL '${urlToCheck}' is inaccessible (HTTP Status: ${response.status} - ${response.statusText})`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(
          `AssetService: ${assetPrefix} - Failed to check URL '${urlToCheck}': ${errorMsg}`
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
      "AssetService: checkAssetsExistence completed with errors:",
      errors
    );
    return errors;
  }

  private displayLoadResults(
    results: { assetName: string; success: boolean; error?: string }[]
  ): void {
    console.log(
      "AssetService: displayLoadResults called with results:",
      results
    );
    const successfulAssets = results.filter((result) => result.success);
    const failedAssets = results.filter((result) => !result.success);
    const messages: any[] = [];

    console.log(
      `AssetService: Load summary - Successful: ${successfulAssets.length}, Failed: ${failedAssets.length}`
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
    console.log("AssetService: displayLoadResults completed");
  }
}
