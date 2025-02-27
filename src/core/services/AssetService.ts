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
  private scene: Scene;
  private loadedAssets: Set<string> = new Set();
  private assetsMap: Map<string, AssetInfo> = new Map();
  private successMessages: string[] = [];
  private spineCharacter: SpineGameObject | null = null;
  private assetsLoaded: boolean = false;
  private lastFailedSpines = new Map<string, number>(); // מפתח: שם הנכס, ערך: זמן כישלון אחרון

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // === Asset Management Methods ===
  public getAssetsMap(): Map<string, AssetInfo> {
    // Info Messages
    // - Returns a copy of the assets map for external use
    return new Map(this.assetsMap);
  }

  public getAssetInfo(assetName: string): AssetInfo | undefined {
    // Info Messages
    // - Retrieves asset info by name from the assets map
    return this.assetsMap.get(assetName);
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

      // בדיקת מבנה
      const structureErrors = this.validateAssetStructure(json);
      if (structureErrors.length > 0) {
        showMessage({
          isOpen: true,
          title: "Asset File Validation Errors",
          messages: structureErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return;
      }

      // בדיקת קיום נכסים
      const existenceErrors = await this.checkAssetsExistence(json.assets);
      if (existenceErrors.length > 0) {
        showMessage({
          isOpen: true,
          title: `Asset Accessibility Issues (${existenceErrors.length})`,
          messages: existenceErrors.map((error) => createErrorMessage(error)),
          autoClose: false,
        });
        return; // מפסיק כאן אם יש שגיאות, אלא אם תרצי להמשיך לטעון נכסים תקינים
      }

      // המשך טעינה...
      await this.registerAssets(json.assets);
      const loadResults = await this.loadAssets(json.assets);
      console.log("Scene created, loading SpineBoy...");
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

      console.log(`Processing asset: ${assetName}`, asset);

      switch (asset.assetType) {
        case "spine":
          const spineUrl = asset.assetUrl as {
            atlasUrl: string;
            skeletonUrl: string;
            skeletonType?: "binary" | "json";
          };
          console.log("Spine URL object:", spineUrl);
          newAssetInfo = {
            type: "spine",
            atlasUrl: spineUrl.atlasUrl,
            skeletonUrl: spineUrl.skeletonUrl,
            skeletonType: spineUrl.skeletonType || "json",
          } as SpineAssetInfo;
          console.log(`Registering spine asset ${assetName}:`, newAssetInfo);
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
      this.assetsMap.set(assetName, newAssetInfo);
      console.log(
        `Saved to assetsMap: ${assetName}`,
        this.assetsMap.get(assetName)
      );
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

    // אם זה spine ונכשל בעבר, ננסה לטעון אותו מחדש אם עבר מספיק זמן
    if (assetInfo.type === "spine" && this.lastFailedSpines.has(assetName)) {
      const lastFailedTime = this.lastFailedSpines.get(assetName) || 0;
      const now = Date.now();

      // ננסה לטעון מחדש כל 5 שניות
      if (now - lastFailedTime > 5000) {
        console.log(
          `Attempting to reload spine asset ${assetName} after previous failure`
        );
        // שימוש ב-then במקום async/await
        this.loadSpineAsset(assetName, assetInfo as SpineAssetInfo).then(
          (result) => {
            if (result.success) {
              console.log(`Successfully reloaded spine asset ${assetName}`);
              this.lastFailedSpines.delete(assetName);
            } else {
              console.log(
                `Failed to reload spine asset ${assetName}: ${result.error}`
              );
              this.lastFailedSpines.set(assetName, now);
            }
          }
        );
      }
    }

    this.cleanupExistingSprite(assetInfo);
    const sprite = this.createSprite(assetName, assetInfo, properties);
    this.applyBasicProperties(sprite, properties);
    if (sprite instanceof Phaser.GameObjects.Sprite) {
      this.applyAdvancedProperties(sprite, properties);
    }

    // אם ניסינו ליצור spine אבל קיבלנו sprite רגיל, נשמור את זה ברשימת כישלונות
    if (assetInfo.type === "spine" && !(sprite instanceof SpineGameObject)) {
      this.lastFailedSpines.set(assetName, Date.now());
    }

    this.successMessages.push(
      `displayAsset [Displayed ${assetName} (${assetInfo.type}) on scene]`
    );
    return sprite;
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
    const centerX = this.scene.cameras.main.centerX + (properties.x ?? 0);
    const centerY = this.scene.cameras.main.centerY + (properties.y ?? 0);

    if (assetInfo.type === "video") {
      const video = this.scene.add.video(centerX, centerY, assetName);
      video.play(true);
      return video;
    }
    if (assetInfo.type === "spine") {
      try {
        const atlasKey = `${assetName}_atlas`;
        const skeletonKey = assetName;

        // בדיקת קיום המפתחות במטמון
        if (this.scene.cache.custom && this.scene.cache.custom.spine) {
          console.log(
            `Checking cache: atlas=${this.scene.cache.custom.spine.has(
              atlasKey
            )}, skeleton=${
              this.scene.cache.json.has(skeletonKey) ||
              this.scene.cache.binary.has(skeletonKey)
            }`
          );
        } else {
          console.log("Spine cache not available");
        }

        // קריאה לspine
        const spine1 = this.scene.add.spine(
          centerX,
          centerY,
          assetName,
          atlasKey
        );

        console.log(
          `Creating spine for ${assetName} with atlas ${assetName}Atlas`
        );
        const spine = this.scene.add.spine(
          centerX,
          centerY,
          assetName,
          `${assetName}_atlas`
        );

        console.log("Spine object created:", spine);
        console.log("Has skeleton?", !!spine.skeleton);

        if (spine.skeleton) {
          console.log("Has skeleton.data?", !!spine.skeleton.data);
        }

        // בדיקה בטוחה אם יש אנימציות זמינות
        if (spine?.skeleton?.data?.animations?.length > 0) {
          console.log(
            "Animations available:",
            spine.skeleton.data.animations.map((a) => a.name)
          );
          spine.animationState.setAnimation(
            0,
            spine.skeleton.data.animations[2].name,
            true
          );
        } else {
          console.error("No animations found or animations array is empty");
        }

        return spine;
      } catch (error) {
        console.error(`Error creating spine object for ${assetName}:`, error);
        // במקרה של שגיאה, ניתן להחזיר sprite ריק או לזרוק את השגיאה הלאה
        try {
          return this.scene.add.sprite(centerX, centerY, "error_placeholder");
        } catch (e) {
          console.error("Could not create error placeholder sprite:", e);
          // במקרה קיצוני, החזר אובייקט ספרייט ריק
          return this.scene.add.sprite(centerX, centerY, "");
        }
      }
    }

    // במקרה של נכס רגיל מסוג תמונה
    return this.scene.add.sprite(centerX, centerY, assetName);
  }

  public async createTestSpine(
    x: number,
    y: number
  ): Promise<SpineGameObject | null> {
    console.log("Creating test spine directly");
    try {
      // טען תמיד את הקבצים מחדש
      this.scene.load.spineAtlas(
        "spineboyAtlas",
        "assets/spines/skelSpineBoy/spineboy-pma.atlas"
      );
      this.scene.load.spineBinary(
        "spineboy",
        "assets/spines/skelSpineBoy/spineboy-pro.skel"
      );

      // המתן לסיום הטעינה
      await new Promise<void>((resolve, reject) => {
        this.scene.load.once("complete", () => {
          console.log("Spine files loaded successfully");
          resolve();
        });
        this.scene.load.once("loaderror", (file: { url: any }) => {
          console.error("Failed to load spine files:", file);
          reject(new Error(`Failed to load: ${file.url}`));
        });
        this.scene.load.start();
      });

      // בדוק אם יש שגיאות במטמון
      console.log("Creating spine object now");

      // יצירת אובייקט ה-Spine
      const spineObj = this.scene.add.spine(x, y, "spineboy", "spineboyAtlas");
      spineObj.setScale(0.5);
      console.log("Test spine created successfully:", spineObj);

      if (spineObj.skeleton?.data?.animations?.length > 0) {
        console.log(
          "Available animations:",
          spineObj.skeleton.data.animations.map((a) => a.name)
        );
        const firstAnimation = spineObj.skeleton.data.animations[0].name;
        console.log("Setting animation to:", firstAnimation);
        spineObj.animationState.setAnimation(0, firstAnimation, true);
      } else {
        console.warn("No animations found in spine object");
      }

      return spineObj;
    } catch (error) {
      console.error("Error in createTestSpine:", error);
      return null;
    }
  }

  private applyBasicProperties(
    sprite:
      | Phaser.GameObjects.Video
      | SpineGameObject
      | Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    const anchorX = properties.anchor?.x ?? 0.5;
    const anchorY = properties.anchor?.y ?? 0.5;

    if (
      sprite instanceof Phaser.GameObjects.Sprite ||
      sprite instanceof Phaser.GameObjects.Video
    ) {
      sprite.setOrigin(anchorX, anchorY);
      sprite.setAlpha(properties.alpha ?? 1);
      sprite.setVisible(true);
      if (properties.scale !== undefined) {
        sprite.setScale(properties.scale);
      }
    } else if (sprite instanceof SpineGameObject) {
      sprite.setOrigin(anchorX, anchorY);
      sprite.setAlpha(properties.alpha ?? 1);
      sprite.setVisible(true);
      if (properties.scale !== undefined) {
        sprite.setScale(properties.scale);
      }
    }
  }

  private applyAdvancedProperties(
    sprite: Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    // Info Messages
    // - Applies advanced properties like ratio, rotation, and tint to sprites
    if (properties.ratio) {
      this.applyAspectRatio(sprite, properties);
    }

    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }

    if (properties.tint !== undefined) {
      sprite.setTint(properties.tint);
    }

    if (properties.pivot) {
      sprite.setOrigin(properties.pivot.x, properties.pivot.y);
    }
  }

  private applyAspectRatio(
    sprite: Phaser.GameObjects.Sprite,
    properties: AssetDisplayProperties
  ): void {
    // Info Messages
    // - Adjusts sprite scale to maintain target aspect ratio
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
    // Info Messages
    // - Hides and cleans up all assets in the map
    for (const [assetName, assetInfo] of this.assetsMap.entries()) {
      this.cleanupExistingSprite(assetInfo);
      this.resetAssetInfo(assetName, assetInfo);
    }
  }

  private resetAssetInfo(assetName: string, assetInfo: AssetInfo): void {
    // Info Messages
    // - Resets asset info to remove sprite reference
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
      console.error(`Asset ${assetName} not found in assetsMap`);
      return { success: false, error: `Asset ${assetName} not found` };
    }
    console.log(
      `Starting to load asset: ${assetName} (type: ${assetInfo.type})`
    );

    if (this.isAssetLoaded(assetName)) {
      console.log(`Asset ${assetName} already loaded`);
      return { success: true };
    }

    switch (assetInfo.type) {
      case "video":
        console.log(`Loading video with URL: ${assetInfo.url}`);
        return this.loadVideoAsset(assetName, assetInfo as VideoAssetInfo);
      case "spine":
        const spineInfo = assetInfo as SpineAssetInfo;
        console.log(
          `Loading spine with atlas: ${spineInfo.atlasUrl}, skeleton: ${spineInfo.skeletonUrl}`
        );
        if (!spineInfo.atlasUrl || !spineInfo.skeletonUrl) {
          console.error(
            `Spine asset ${assetName} missing atlasUrl or skeletonUrl`
          );
          return { success: false, error: `Missing Spine URLs` };
        }
        return this.loadSpineAsset(assetName, spineInfo);
      case "particle":
        console.log(`Loading particle with URL: ${assetInfo.url}`);
        return this.loadParticleAsset(
          assetName,
          assetInfo as ParticleAssetInfo
        );
      case "image":
        console.log(`Loading image with URL: ${assetInfo.url}`);
        return this.loadImageAsset(assetName, assetInfo as ImageAssetInfo);
      default:
        console.error(`Unsupported asset type for ${assetName}: `);
        return {
          success: false,
          error: `Unsupported asset type: ${assetInfo}`,
        };
    }
  }

  private async loadAssetByType(
    assetName: string,
    assetInfo: AssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    // Info Messages
    // - Routes asset loading to specific type handlers
    switch (assetInfo.type) {
      case "particle":
        return this.loadParticleAsset(
          assetName,
          assetInfo as ParticleAssetInfo
        );
      case "image":
        return this.loadImageAsset(assetName, assetInfo as ImageAssetInfo);
      case "video":
        return this.loadVideoAsset(assetName, assetInfo as VideoAssetInfo);
      case "spine":
        return this.loadSpineAsset(assetName, assetInfo as SpineAssetInfo);
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
        // upload to Phaser
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
          `Image failed to load for '${assetName}' at URL '${assetInfo.url}'`
        );
        this.scene.load.off("complete"); // ניקוי האזנה כדי למנוע תגובה כפולה
        resolve({
          success: false,
          error: `Invalid or inaccessible image URL for '${assetName}': '${assetInfo.url}'`,
        });
      };

      // Initial check of URL integrity before loading
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

  // add to ssetService
  public diagnoseSpineAsset(assetName: string): void {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      console.error(`Asset ${assetName} not found in assetsMap`);
      return;
    }

    if (assetInfo.type !== "spine") {
      console.error(
        `Asset ${assetName} is not a Spine asset (type: ${assetInfo.type})`
      );
      return;
    }

    const spineInfo = assetInfo as SpineAssetInfo;

    console.log("=== Spine Asset Diagnosis ===");
    console.log(`Asset name: ${assetName}`);
    console.log(`Atlas URL: ${spineInfo.atlasUrl}`);
    console.log(`Skeleton URL: ${spineInfo.skeletonUrl}`);
    console.log(`Skeleton type: ${spineInfo.skeletonType}`);

    if ("sprite" in spineInfo && spineInfo.sprite) {
      console.log("Sprite exists:", !!spineInfo.sprite);

      if (spineInfo.sprite instanceof SpineGameObject) {
        console.log("Is SpineGameObject: YES");
        console.log("Has skeleton:", !!spineInfo.sprite.skeleton);
        console.log("Has state:", !!spineInfo.sprite.state);

        if (spineInfo.sprite.skeleton && spineInfo.sprite.skeleton.data) {
          const animations = spineInfo.sprite.skeleton.data.animations;
          console.log(`Available animations (${animations.length}):`);
          animations.forEach((anim, idx) => {
            console.log(
              `  ${idx + 1}. ${anim.name} (duration: ${anim.duration}s)`
            );
          });
        } else {
          console.error("Skeleton or skeleton.data is null");
        }
      } else {
        console.error("Is SpineGameObject: NO");
        console.log("Actual type:", spineInfo.sprite.constructor.name);
      }
    } else {
      console.error("Sprite does not exist");
    }
  }

  private async loadSpineAsset(
    assetName: string,
    assetInfo: SpineAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      console.log(
        `Loading Spine asset: ${assetName} (${assetInfo.skeletonType} format)`
      );
      console.log(
        `Atlas URL: ${assetInfo.atlasUrl}, Skeleton URL: ${assetInfo.skeletonUrl}`
      );

      if (!assetInfo.atlasUrl || !assetInfo.skeletonUrl) {
        console.error(`Missing URLs for ${assetName}`);
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
        console.log(`Spine asset ${assetName} files loaded into cache`);
        try {
          const spineObject = this.loadedAssets.add(assetName);

          // const spineObject = this.scene.add.spine(
          //   this.scene.scale.width / 2,
          //   this.scene.scale.height / 2,
          //   skeletonKey,
          //   atlasKey
          // );
          //spineObject.setScale(0.5);
          //spineObject.setVisible(true);
          console.log("Spine object created:", spineObject);
          //console.log("Has state?", !!spineObject.state);
          //console.log("Has animationState?", !!spineObject.animationState);

          // if (spineObject.skeleton) {
          //  const animations = spineObject.skeleton.data.animations;
          //  console.log(
          //   "Animations:",
          //    animations.map((a) => a.name)
          // );
          // if (animations.length > 0) {
          // if (spineObject.animationState) {
          //   console.log("Using animationState");
          //   spineObject.animationState.setAnimation(
          //     0,
          //     animations[0].name,
          //     true
          //   );
          //} else {
          //  console.warn("No state or animationState found in spineObject");
          //}
          //  }
          // } else {
          //  console.warn("No skeleton found in spineObject");
          //}

          this.loadedAssets.add(assetName);
          this.assetsMap.set(assetName, { ...assetInfo, sprite: undefined });
          console.log(`Spine asset ${assetName} loaded successfully`);
          resolve({ success: true });
        } catch (error) {
          console.error(`Error creating spine object for ${assetName}:`, error);
          resolve({
            success: false,
            error: `Failed to create Spine object: `,
          });
        }
      });

      this.scene.load.once("loaderror", (file: Phaser.Loader.File) => {
        console.error(`Error loading spine asset ${assetName}: ${file.url}`);
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
    // Info Messages
    // - Loads a video asset into the scene
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
            // Success Messages
            // - loadVideoAsset [Loaded video ${assetName} successfully]
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
            `Asset ${result.assetName} not found in assetsMap after loading`
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
              `Video ${result.assetName} reported as successful. Does video object exist? ${assetExists}`
            );
            break;
          case "image":
          case "particle":
            assetExists = this.scene.textures.exists(result.assetName);
            console.log(
              `Asset ${result.assetName} (type: ${assetInfo.type}) reported as successful. Does texture exist? ${assetExists}`
            );
            break;
          case "spine":
            assetExists =
              !!assetInfo.sprite &&
              "skeleton" in assetInfo.sprite &&
              ("state" in assetInfo.sprite ||
                "animationState" in assetInfo.sprite);
            console.log(
              `Spine ${result.assetName} reported as successful. Does spine object exist? ${assetExists}`
            );
            break;
          default:
            console.warn(
              `Unknown asset type for ${result.assetName}: ${assetInfo}`
            );
            assetExists = true;
        }

        // i dont want the spine to have its sprotes on screen before timeline os loaded
        if (!assetExists && assetInfo.type != "spine") {
          console.error(
            `Asset ${result.assetName} reported success but asset verification failed!`
          );
          result.success = false;
          result.error = "Asset verification failed after loading";
        }
      }
    }

    if (failedAssets.length > 0) {
      console.error(
        "Failed to load assets:",
        failedAssets.map((fa) => `${fa.assetName}: ${fa.error}`)
      );
    }

    if (successfulAssets.length === 0) {
      throw new Error("No assets could be loaded");
    }

    return results;
  }

  public async loadSpineBoyDirectlyWithFiles(): Promise<void> {
    try {
      const key = `spineboy-${Date.now()}`;

      const skelFile = new File([], "spineboy-pro.skel");
      const atlasFile = new File([], "spineboy-pma.atlas");
      const pngFiles = [new File([], "spineboy-pma.png")];

      console.log("Files prepared:", {
        skel: skelFile.name,
        atlas: atlasFile.name,
        pngs: pngFiles.map((f) => f.name),
      });

      const basePath = "assets/skelSpineBoy/";
      const skelURL = `${basePath}spineboy-pro.skel`;
      const atlasURL = `${basePath}spineboy-pma.atlas`;
      const pngMap = new Map(
        pngFiles.map((file) => {
          const url = `${basePath}${file.name}`;
          console.log(`Mapping ${file.name} to ${url}`);
          return [file.name, url];
        })
      );

      const prevX = this.scene.scale.width / 2;
      const prevY = this.scene.scale.height / 2;

      if (this.spineCharacter) {
        this.spineCharacter.destroy();
        this.spineCharacter = null;
      }

      if (skelFile.name.endsWith(".json")) {
        this.scene.load.spineJson(key, skelURL);
      } else {
        this.scene.load.spineBinary(key, skelURL);
      }
      this.scene.load.spineAtlas(`${key}Atlas`, atlasURL, true);

      for (const [filename, url] of pngMap) {
        console.log(`Loading texture: ${key}Atlas!${filename} from ${url}`);
        this.scene.load.image(`${key}Atlas!${filename}`, url);
      }

      await new Promise<void>((resolve, reject) => {
        this.scene.load.once("complete", () => {
          console.log("All assets loaded successfully");
          this.assetsLoaded = true;
          resolve();
        });

        this.scene.load.once("loaderror", (file: any) => {
          console.error("Error loading asset:", file);
          reject(new Error(`Failed to load asset: ${file.key}`));
        });

        this.scene.load.start();
      });

      if (this.assetsLoaded) {
        console.log("Creating spine character...");
        this.spineCharacter = this.scene.add.spine(prevX, prevY, key, "walk");

        if (this.spineCharacter) {
          console.log("Spine character created:", this.spineCharacter);
          if (this.spineCharacter && this.spineCharacter.state) {
            this.spineCharacter.animationState.setAnimation(
              0,
              "animation",
              false
            );
          }
          console.log(
            "Available animations:",
            this.spineCharacter.skeleton.data.animations
          );

          const spineInfo: SpineAssetInfo = {
            type: "spine",
            atlasUrl: atlasURL,
            skeletonUrl: skelURL,
            skeletonType: "binary",
            url: "",
            sprite: this.spineCharacter,
          };
          this.assetsMap.set(key, spineInfo);
        } else {
          console.error("Failed to create spine character!");
        }
      }
    } catch (error) {
      console.error("Error loading SpineBoy:", error);
      throw error;
    }
  }

  public async testSpineLoad(): Promise<void> {
    console.log("Testing Spine load...");
    this.scene.load.spineAtlas(
      "spineboyAtlas",
      "assets/skelSpineBoy/spineboy-pma.atlas"
    );
    this.scene.load.spineBinary(
      "spineboy",
      "assets/skelSpineBoy/spineboy-pro.skel"
    );

    await new Promise((resolve, reject) => {
      this.scene.load.once("complete", () => {
        console.log("Spine files loaded!");
        const spineObj = this.scene.add.spine(400, 300, "spineboy", "walk");
        console.log("Spine object:", spineObj);
        resolve(true);
      });
      this.scene.load.once("loaderror", (file: { url: any }) => {
        console.error("Load failed:", file);
        reject(new Error(`Failed to load: ${file.url}`));
      });
      this.scene.load.start();
    });
  }

  private displayLoadResults(
    results: {
      assetName: string;
      success: boolean;
      error?: string;
    }[]
  ): void {
    const successfulAssets = results.filter((result) => result.success);
    const failedAssets = results.filter((result) => !result.success);
    const messages: any[] = [];

    // Title with summary
    messages.push(
      createInfoMessage(
        `Asset Loading Summary: ${successfulAssets.length} succeeded, ${failedAssets.length} failed`
      )
    );

    // success
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

    // failers
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
      autoClose: failedAssets.length === 0, // סגירה אוטומטית רק אם אין כשלונות
      autoCloseTime: 7000,
    });
  }

  public isAssetLoaded(assetName: string): boolean {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) return false;

    const isLoaded = this.loadedAssets.has(assetName);

    if (assetInfo.type === "image") {
      return (
        isLoaded &&
        (assetInfo as ImageAssetInfo).sprite instanceof
          Phaser.GameObjects.Sprite
      );
    }
    if (assetInfo.type === "video") {
      return (
        isLoaded &&
        (assetInfo as VideoAssetInfo).sprite instanceof Phaser.GameObjects.Video
      );
    }
    if (assetInfo.type === "particle") {
      return isLoaded && !!(assetInfo as ParticleAssetInfo).textureName;
    }

    if (assetInfo.type === "spine") {
      return (
        isLoaded &&
        "sprite" in assetInfo &&
        assetInfo.sprite instanceof Phaser.GameObjects.GameObject
      );
    }
    return false;
  }

  // === Validation Methods ===
  private validateAssetStructure(json: AssetJson): string[] {
    const errors: string[] = [];

    if (!json.assets || !Array.isArray(json.assets)) {
      errors.push(
        "Invalid JSON structure - 'assets' key is missing or not an array"
      );
      return errors;
    }

    json.assets.forEach((asset, index) => {
      const assetPrefix = `Asset #${index + 1} (${
        asset.assetName || "unnamed"
      })`;

      // בדיקת assetName
      if (
        !asset.assetName ||
        typeof asset.assetName !== "string" ||
        asset.assetName.trim() === ""
      ) {
        errors.push(
          `${assetPrefix}: 'assetName' is missing, not a string, or empty`
        );
      }

      // cheking assetType
      const validTypes = ["image", "video", "particle", "spine"];
      if (!asset.assetType || !validTypes.includes(asset.assetType)) {
        errors.push(
          `${assetPrefix}: 'assetType' is missing or invalid, must be one of ${validTypes.join(
            ", "
          )}`
        );
      }

      // cheking assetUrl
      if (!asset.assetUrl) {
        errors.push(`${assetPrefix}: 'assetUrl' is missing`);
      } else if (asset.assetType === "spine") {
        // cheking spine
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
            // cheking skeleton ending
            const validSkeletonExts = [".json", ".skel"];
            const hasValidSkeletonExt = validSkeletonExts.some((ext) =>
              spineUrl.skeletonUrl.toLowerCase().endsWith(ext)
            );
            if (!hasValidSkeletonExt) {
              errors.push(
                `${assetPrefix}: 'skeletonUrl' must end with .json or .skel: '${spineUrl.skeletonUrl}'`
              );
            }
          }

          if (!spineUrl.atlasUrl) {
            errors.push(`${assetPrefix}: Missing 'atlasUrl' for spine asset`);
          } else if (typeof spineUrl.atlasUrl !== "string") {
            errors.push(`${assetPrefix}: 'atlasUrl' must be a string`);
          } else if (!spineUrl.atlasUrl.toLowerCase().endsWith(".atlas")) {
            errors.push(
              `${assetPrefix}: 'atlasUrl' must end with .atlas: '${spineUrl.atlasUrl}'`
            );
          }
        }
      } else {
        // cheking regular files (not spine)
        if (typeof asset.assetUrl !== "string") {
          errors.push(
            `${assetPrefix}: 'assetUrl' must be a string, got ${typeof asset.assetUrl}`
          );
        } else {
          const url = asset.assetUrl.trim();
          if (!url) {
            errors.push(`${assetPrefix}: 'assetUrl' is empty`);
          } else {
            // cheking basic URL
            const urlRegex = /^[a-zA-Z0-9\/._-]*$/; // תווים חוקיים בלבד (ללא תווים מיוחדים)
            if (!urlRegex.test(url)) {
              errors.push(
                `${assetPrefix}: 'assetUrl' contains invalid characters: '${url}'`
              );
            }

            // cheking file ending
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
              errors.push(
                `${assetPrefix}: 'assetUrl' does not end with a supported file extension: '${url}'`
              );
            }
          }
        }
      }
    });

    return errors;
  }

  private async checkAssetsExistence(
    assets: AssetElement[]
  ): Promise<string[]> {
    const errors: string[] = [];

    for (const asset of assets) {
      const assetPrefix = `Asset '${asset.assetName}'`;
      let urlToCheck = asset.assetUrl as string;

      // Skip if an error has already been found in the structure

      if (typeof urlToCheck !== "string" || !urlToCheck.trim()) {
        // Skip if an error has already been found in the structure validateAssetStructure
        continue;
      }

      try {
        console.log(
          `${assetPrefix}: Checking existence of URL '${urlToCheck}'`
        );
        const response = await fetch(urlToCheck, { method: "HEAD" });

        if (!response.ok) {
          errors.push(
            `${assetPrefix}: URL '${urlToCheck}' is inaccessible (HTTP Status: ${response.status} - ${response.statusText})`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
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

    return errors;
  }

  private async checkSingleAssetUrl(
    assetPrefix: string,
    url: string,
    errors: string[]
  ): Promise<void> {
    try {
      console.log(`${assetPrefix}: Checking URL '${url}'`);
      const response = await fetch(url, { method: "HEAD" });

      if (!response.ok) {
        errors.push(
          `${assetPrefix}: URL '${url}' is inaccessible (HTTP Status: ${response.status} - ${response.statusText})`
        );
        return;
      }

      // cheking file size  (if available)
      const contentLength = response.headers.get("Content-Length");
      if (contentLength && parseInt(contentLength) === 0) {
        errors.push(
          `${assetPrefix}: URL '${url}' points to an empty file (size: 0 bytes)`
        );
      }

      //checking kind of file (Content-Type)
      const contentType = response.headers.get("Content-Type");
      if (!contentType) {
        errors.push(`${assetPrefix}: URL '${url}' has no Content-Type header`);
      } else if (
        (url.endsWith(".png") && !contentType.includes("image/png")) ||
        (url.endsWith(".jpg") && !contentType.includes("image/jpeg")) ||
        (url.endsWith(".mp4") && !contentType.includes("video/mp4"))
      ) {
        errors.push(
          `${assetPrefix}: URL '${url}' has mismatched Content-Type '${contentType}'`
        );
      }
    } catch (error) {
      errors.push(
        `${assetPrefix}: Failed to check URL '${url}' - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // === Debug Methods ===
  public debugAssetSizes(): void {
    // Info Messages
    // - Logs size information for all sprite-based assets
    console.log("=== Asset Sizes Debug Info ===");
    this.assetsMap.forEach((assetInfo, assetName) => {
      if (
        "sprite" in assetInfo &&
        assetInfo.sprite instanceof Phaser.GameObjects.Sprite
      ) {
        const sprite = assetInfo.sprite;
        const texture = sprite.texture;
        const sourceImage = texture.getSourceImage();
        console.log(`Asset: ${assetName}`, {
          originalSize: `${sourceImage.width}x${sourceImage.height}`,
          displaySize: `${sprite.displayWidth}x${sprite.displayHeight}`,
          scale: `${sprite.scaleX}x${sprite.scaleY}`,
          origin: `${sprite.originX}x${sprite.originY}`,
        });
      }
    });
  }

  public debugAssetsState(): void {
    const assetsMap = this.getAssetsMap();
    const messages: any[] = []; // Ensure this line exists and isn’t modified

    messages.push(createInfoMessage("Success Messages"));

    assetsMap.forEach((asset, name) => {
      const isLoaded = this.isAssetLoaded(name);
      if (isLoaded) {
        let scaleX = 1,
          scaleY = 1,
          aspectRatio = "N/A",
          pivotX = 0.5,
          pivotY = 0.5;
        if ("sprite" in asset && asset.sprite) {
          const sprite = asset.sprite;
          if (
            sprite instanceof Phaser.GameObjects.Sprite ||
            sprite instanceof Phaser.GameObjects.Video
          ) {
            scaleX = sprite.scaleX || 1;
            scaleY = sprite.scaleY || 1;
            pivotX = sprite.originX || 0.5;
            pivotY = sprite.originY || 0.5;
          } else if ("skeleton" in sprite && "state" in sprite) {
            // This is a spine object
            scaleX =
              "scaleX" in sprite
                ? (sprite as any).scaleX
                : "scale" in sprite
                ? (sprite as any).scale
                : 1;
            scaleY =
              "scaleY" in sprite
                ? (sprite as any).scaleY
                : "scale" in sprite
                ? (sprite as any).scale
                : 1;
            pivotX = 0.5;
            pivotY = 0.5;
          }
          if (sprite instanceof Phaser.GameObjects.Sprite && sprite.texture) {
            const sourceImage = sprite.texture.getSourceImage();
            aspectRatio = `${sourceImage.width}x${sourceImage.height}`;
          } else if (
            sprite instanceof Phaser.GameObjects.Video &&
            sprite.video
          ) {
            aspectRatio =
              `${sprite.video.videoWidth}x${sprite.video.videoHeight}` ||
              "16x9";
          }
        }
        const assetDetails = `${name} (${asset.type}) [scale: ${scaleX}x${scaleY}, aspect ratio: ${aspectRatio}, pivot: (${pivotX},${pivotY})]`;
        console.log("messages before push:", messages); // Debug
        messages.push(createSuccessMessage(assetDetails)); // This should be safe
      }
    });

    showMessage({
      isOpen: true,
      title: "Assets Loaded - assets.json",
      messages:
        messages.length > 1
          ? messages
          : [createInfoMessage("No assets loaded.")],
      autoClose: messages.length > 1,
      autoCloseTime: 5000,
    });
  }
}
