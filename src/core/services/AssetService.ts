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
  AudioAssetInfo,
  TextAssetInfo,
} from "../../types/interfaces/AssetInterfaces";
import {
  showMessage,
  createErrorMessage,
  createSuccessMessage,
  createInfoMessage,
} from "../../ui/ErrorModal/MessageModal";
import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist/SpineGameObject";

export class AssetService {
  private systemFonts: string[] = [
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Times",
    "Courier New",
    "Courier",
    "Verdana",
    "Georgia",
    "Palatino",
    "Garamond",
    "Bookman",
    "Comic Sans MS",
    "Trebuchet MS",
    "Arial Black",
    "Impact",
    "Tahoma",
  ];
  getAssetElement(assetName: string) {
    throw new Error("Method not implemented.");
  }
  private scene: Scene;
  private loadedAssets: Set<string> = new Set();
  private assetsMap: Map<string, AssetInfo> = new Map();
  private elementsMap: Map<
    string,
    {
      assetName: string;
      sprite: any;
      originalScale: number;
      originalRelativeX: number;
      originalRelativeY: number;
    }
  > = new Map();
  private successMessages: string[] = [];
  private formerScreenScale: { x: number; y: number } = { x: 0, y: 0 };
  private initialWidth: number;
  private initialHeight: number;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initialWidth = scene.scale.width;
    this.initialHeight = scene.scale.height;
    if (this.formerScreenScale.x === 0 && this.formerScreenScale.y === 0) {
      this.formerScreenScale = {
        x: this.initialWidth,
        y: this.initialHeight,
      };
    }
  }

  // Get the font family for a given assetName
  public getFontFamily(assetName: string): string | undefined {
    console.log("in get fnt family");
    const assetInfo = this.assetsMap.get(assetName);
    if (assetInfo && assetInfo.type === "text") {
      const textInfo = assetInfo as TextAssetInfo;
      console.log(
        `AssetService: getFontFamily for ${assetName} returned ${textInfo.fontFamily}`
      );
      return textInfo.fontFamily; // Return the fontFamily from the registered asset
    }
    console.log(`AssetService: No text asset found for ${assetName}`);
    return undefined; // Return undefined if no text asset is found
  }

  public getElementSprite(elementName: string): any {
    const element = this.elementsMap.get(elementName);
    return element ? element.sprite : null;
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

  private isSystemFont(fontFamily: string | undefined): boolean {
    if (!fontFamily) {
      console.log(`fontFamily is undefined or empty, returning false`);
      return false;
    }

    const result = this.systemFonts.includes(fontFamily);
    console.log(`Checking if "${fontFamily}" is a system font: ${result}`);
    // console.log(`Available system fonts:`, this.systemFonts);

    return result;
  }

  // === Asset Loading Methods ===
  public async handleAssetsJson(file: File): Promise<void> {
    try {
      const fileContent = await file.text();
      const json = JSON.parse(fileContent) as AssetJson;

      // בדיקת מבנה ה-JSON
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

      // בדיקת נגישות הנכסים
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

      // רישום והוספת הנכסים למפה
      await this.registerAssets(json.assets);

      // טעינת הנכסים
      const loadResults = await this.loadAssets(json.assets);
      this.displayLoadResults(loadResults);

      // בדיקה אם יש אלמנטים ב-JSON והצגתם
      if (json.elements && Array.isArray(json.elements)) {
        console.log(
          "AssetService: Displaying elements from JSON:",
          json.elements
        );
        json.elements.forEach((element) => {
          const assetName = element.assetName;
          const elementName = element.elementName;

          // וידוא שהנכס נטען בהצלחה
          if (!this.loadedAssets.has(assetName)) {
            console.warn(
              `AssetService: Cannot display ${elementName} - ${assetName} not loaded`
            );
            return;
          }

          // הגדרות להצגה מה-initialState
          const properties: AssetDisplayProperties = {
            ...element.initialState,
            play: false, // להבטיח שהאודיו ינוגן אוטומטית
          };

          // הצגת האלמנט
          this.displayAsset(assetName, properties, elementName);
          console.log(
            `AssetService: Displayed ${elementName} with asset ${assetName}`
          );
        });
      } else {
        console.log("AssetService: No elements found in JSON to display");
      }
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
    // List of common system fonts

    assets.forEach((asset) => {
      const assetName = asset.assetName.trim();
      let newAssetInfo: AssetInfo;

      switch (asset.assetType) {
        case "text":
          const fontFamily = asset.fontFamily || "Arial";
          console.log(
            `Registering text asset ${assetName} with font ${fontFamily}`
          );

          // Check if it's a system font
          const isSystemFont = this.isSystemFont(fontFamily);
          console.log(`Is ${fontFamily} a system font? ${isSystemFont}`);

          newAssetInfo = {
            type: "text",
            // For system fonts, we don't need a URL
            url: isSystemFont ? "" : (asset.assetUrl as string),
            fontFamily: fontFamily,
            isSystemFont: isSystemFont, // Add a flag to indicate it's a system font
          } as TextAssetInfo;

          console.log(`Created text asset info:`, newAssetInfo);
          break;

        case "audio":
          newAssetInfo = {
            type: "audio",
            url: asset.assetUrl as string,
          } as AudioAssetInfo;
          break;
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
    properties: AssetDisplayProperties,
    elementName: string
  ):
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Particles.ParticleEmitter
    | Phaser.Sound.WebAudioSound
    | Phaser.GameObjects.Text {
    const assetInfo = this.assetsMap.get(assetName);
    if (!assetInfo) {
      throw new Error(`Asset ${assetName} not found`);
    }

    this.cleanupExistingSprite(assetInfo);

    const spriteOrAudio = this.createSprite(assetName, assetInfo, properties);

    if (spriteOrAudio instanceof Phaser.Sound.WebAudioSound) {
      this.applyAudioProperties(spriteOrAudio, properties);
    } else if (
      spriteOrAudio instanceof Phaser.GameObjects.Video ||
      spriteOrAudio instanceof SpineGameObject ||
      spriteOrAudio instanceof Phaser.GameObjects.Sprite ||
      spriteOrAudio instanceof Phaser.GameObjects.Particles.ParticleEmitter
    ) {
      spriteOrAudio.name = elementName;
      properties.pivot = this.getAssetPivot(assetName);
      this.applyBasicProperties(spriteOrAudio, properties, assetName);
      if (spriteOrAudio instanceof Phaser.GameObjects.Sprite) {
        this.applyAdvancedProperties(spriteOrAudio, properties);
      }
    }

    // Calculate and save the original relative position based on initial resolution
    const originalX = properties.x ?? this.scene.scale.width / 2; // Default to center if not provided
    const originalY = properties.y ?? this.scene.scale.height / 2; // Default to center if not provided
    const originalRelativeX =
      this.initialWidth > 0 ? originalX / this.initialWidth : 0.5;
    const originalRelativeY =
      this.initialHeight > 0 ? originalY / this.initialHeight : 0.5;
    const originalScale = properties.scale ?? 1;

    this.elementsMap.set(elementName, {
      assetName: assetName,
      sprite: spriteOrAudio,
      originalScale: originalScale,
      originalRelativeX: originalRelativeX, // Save original relative X
      originalRelativeY: originalRelativeY, // Save original relative Y
    });

    this.successMessages.push(
      `displayAsset [Displayed ${assetName} as ${elementName} (${assetInfo.type}) on scene]`
    );

    return spriteOrAudio;
  }

  private cleanupExistingSprite(assetInfo: AssetInfo): void {
    if ("sprite" in assetInfo && assetInfo.sprite) {
      if (assetInfo.sprite instanceof Phaser.GameObjects.Video) {
        assetInfo.sprite.stop();
      }
      if (this.isAudioConfig(assetInfo.sprite)) {
        //assetInfo.sprite.mute;
      } else {
        assetInfo.sprite.destroy();
      }
    }
  }

  private isAudioConfig(obj: any): obj is Phaser.Types.Sound.SoundConfig {
    // בדיקה של מאפיינים ייחודיים ל-SoundConfig
    return (
      obj &&
      (obj.hasOwnProperty("key") ||
        obj.hasOwnProperty("volume") ||
        obj.hasOwnProperty("loop")) &&
      !("destroy" in obj)
    );
  }

  private createSprite(
    assetName: string,
    assetInfo: AssetInfo,
    properties: AssetDisplayProperties
  ):
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Particles.ParticleEmitter
    | Phaser.Sound.WebAudioSound
    | Phaser.GameObjects.Text {
    {
      const x = properties.x ?? 0;
      const y = properties.y ?? 0;

      if (assetInfo.type === "text") {
        const textInfo = assetInfo as TextAssetInfo;
        console.log(`Creating text with font family: ${textInfo.fontFamily}`);

        const style: Phaser.Types.GameObjects.Text.TextStyle & {
          fontWeight?: string;
        } = {
          fontFamily: textInfo.fontFamily || "Arial",
          fontSize: properties.fontSize || "32px",
          color: properties.color || "#ffffff",
          fontStyle: properties.fontStyle || "normal",
          fontWeight: properties.fontWeight || "normal",
        };

        console.log(`Text style being applied:`, style);

        const text = this.scene.add.text(x, y, properties.text || "", style);
        console.log(`Text object created:`, text);
        // ...

        if (properties.textDecoration === "underline") {
          const underline = this.scene.add.graphics();
          const color = parseInt(
            (properties.color || "#ffffff").replace("#", "0x"),
            16
          );
          underline.lineStyle(2, color, 1);
          underline.lineBetween(0, text.height, text.width, text.height);
          underline.setPosition(x, y);
          text.setData("underline", underline);
        }

        return text;
      }

      if (assetInfo.type === "audio") {
        const audio = this.scene.sound.add(assetName, {
          loop: properties.loop ?? false,
          volume: properties.volume ?? 1,
        }) as Phaser.Sound.WebAudioSound; // שינוי ל-WebAudioSound במקום BaseSound
        // הוספת soundKey לאובייקט האודיו
        (audio as any).soundKey = assetName; // Phaser לא מגדיר את זה כברירת מחדל, אז אנחנו מוסיפים ידנית
        if (properties.play) {
          audio.play();
        }

        return audio;
      }
      if (assetInfo.type === "video") {
        const video = this.scene.add.video(x, y, assetName);
        video.play(true);
        return video;
      }
      if (assetInfo.type === "spine") {
        const spine = this.scene.add.spine(
          x,
          y,
          assetName,
          `${assetName}_atlas`
        );
        return spine;
      }
      if (assetInfo.type === "particle") {
        const particleManager = this.scene.add.particles(2, 2, assetName);
        if (properties.emitterConfig) {
          particleManager.createEmitter(); ///properties.emitterConfig);
        }
        particleManager.setPosition(x, y);
        return particleManager; // נשאר ללא שינוי
      }

      const sprite = this.scene.add.sprite(x, y, assetName);
      return sprite;
    }
  }
  private applyAudioProperties(
    audio: Phaser.Sound.BaseSound,
    properties: AssetDisplayProperties
  ): void {
    // אנחנו משתמשים ב-type assertion כדי לעקוף את בדיקת הטיפוסים
    const audioObj = audio as any;

    if (properties.volume !== undefined) {
      audioObj.volume = properties.volume;
    }
    if (properties.loop !== undefined) {
      audioObj.loop = properties.loop;
    }
  }

  private applyBasicProperties(
    sprite:
      | Phaser.GameObjects.Video
      | SpineGameObject
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Particles.ParticleEmitter
      | Phaser.GameObjects.Text,
    properties: AssetDisplayProperties,
    assetName: string
  ):
    | Phaser.GameObjects.Video
    | SpineGameObject
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Text
    | Phaser.GameObjects.Particles.ParticleEmitter {
    const assetInfo = this.assetsMap.get(assetName);

    sprite.setAlpha(properties.alpha ?? 1);
    sprite.setVisible(true);

    if (properties.scale !== undefined) {
      sprite.setScale(properties.scale);
    }
    if (properties.rotation !== undefined) {
      sprite.setRotation(properties.rotation);
    }

    if (sprite instanceof Phaser.GameObjects.Text) {
      if (properties.text !== undefined) {
        sprite.setText(properties.text);
      }
      if (properties.fontSize !== undefined) {
        sprite.setFontSize(properties.fontSize);
      }
      if (properties.color !== undefined) {
        sprite.setColor(properties.color);
      }
      if (
        properties.fontStyle !== undefined ||
        properties.fontWeight !== undefined ||
        properties.textDecoration !== undefined
      ) {
        const style =
          sprite.style as Phaser.Types.GameObjects.Text.TextStyle & {
            fontWeight?: string;
          };
        if (properties.fontStyle) style.fontStyle = properties.fontStyle;
        if (properties.fontWeight) style.fontWeight = properties.fontWeight;
        sprite.setStyle(style);

        // עדכון קו תחתון
        const underline = sprite.getData(
          "underline"
        ) as Phaser.GameObjects.Graphics;
        if (properties.textDecoration === "underline") {
          if (!underline) {
            const color = parseInt(
              (properties.color || "#ffffff").replace("#", "0x"),
              16
            );
            const newUnderline = this.scene.add.graphics();
            newUnderline.lineStyle(2, color, 1);
            newUnderline.lineBetween(
              0,
              sprite.height,
              sprite.width,
              sprite.height
            );
            newUnderline.setPosition(sprite.x, sprite.y);
            sprite.setData("underline", newUnderline);
          } else {
            underline.clear();
            const color = parseInt(
              (properties.color || "#ffffff").replace("#", "0x"),
              16
            );
            underline.lineStyle(2, color, 1);
            underline.lineBetween(
              0,
              sprite.height,
              sprite.width,
              sprite.height
            );
            underline.setPosition(sprite.x, sprite.y);
            underline.setVisible(true);
          }
        } else if (underline) {
          underline.setVisible(false);
        }
      }
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
    // קוד קיים לניקוי האסטים
    for (const [assetName, assetInfo] of this.assetsMap.entries()) {
      this.cleanupExistingSprite(assetInfo);
      this.resetAssetInfo(assetName, assetInfo);
    }

    // ניקוי האלמנטים
    for (const [elementName, element] of this.elementsMap.entries()) {
      if (element.sprite) {
        if (element.sprite instanceof Phaser.GameObjects.Video) {
          element.sprite.stop();
        }
        element.sprite.destroy();
      }
    }

    // ניקוי מפת האלמנטים
    this.elementsMap.clear();
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
      case "text":
        return this.loadFontAsset(assetName, assetInfo as TextAssetInfo);
      case "audio":
        return this.loadAudioAsset(assetName, assetInfo as AudioAssetInfo);
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

  private async loadFontAsset(
    assetName: string,
    assetInfo: TextAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    // Check if the requested font is a system font
    if (this.isSystemFont(assetInfo.fontFamily)) {
      console.log(`Attempting to load font with key: ${assetName}`); // Log the font key
      console.log(`Font family assigned: ${assetInfo.fontFamily}`); // Log the font family
      console.log(
        `Font ${assetInfo.fontFamily} is a system font, using it directly`
      );
      this.loadedAssets.add(assetName);
      this.assetsMap.set(assetName, { ...assetInfo });
      console.log(
        `Font load status: ${
          this.loadedAssets.has(assetName) ? "Loaded" : "Not loaded yet"
        }`
      ); // Check if added to loadedAssets
      return { success: true };
    }

    // For non-system fonts, continue with the existing font loading logic
    return new Promise((resolve) => {
      console.log(`Attempting to load font with key: ${assetName}`); // Log the font key
      console.log(`Font family assigned: ${assetInfo.fontFamily}`); // Log the font family
      const fontFace = new FontFace(
        assetInfo.fontFamily!,
        `url(${assetInfo.url})`
      );

      fontFace
        .load()
        .then((loadedFont) => {
          // @ts-ignore temporary solution
          document.fonts.add(loadedFont);
          document.fonts.ready.then(() => {
            this.loadedAssets.add(assetName);
            this.assetsMap.set(assetName, { ...assetInfo });
            console.log(`Font ${assetName} loaded successfully`);
            console.log(
              `Font load status: ${
                this.loadedAssets.has(assetName) ? "Loaded" : "Not loaded yet"
              }`
            ); // Check if added to loadedAssets
            resolve({ success: true });
          });
        })
        .catch((error) => {
          console.error(`Failed to load font ${assetName}: ${error}`);
          console.log(
            `Font load status: ${
              this.loadedAssets.has(assetName) ? "Loaded" : "Not loaded yet"
            }`
          ); // Check status on failure
          resolve({
            success: false,
            error: `Failed to load font ${assetName}: ${error.message}`,
          });
        });
    });
  }

  private async loadAudioAsset(
    assetName: string,
    assetInfo: AudioAssetInfo
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const supportedFormats = ["mp3", "wav", "ogg"];
      const fileExtension = assetInfo.url.split(".").pop()?.toLowerCase();

      if (!fileExtension || !supportedFormats.includes(fileExtension)) {
        console.error(
          `Error: Unsupported file format for ${assetName}: ${fileExtension}`
        );
        return resolve({
          success: false,
          error: `Unsupported audio format: ${fileExtension}`,
        });
      }

      console.log(
        `Starting accessibility check for ${assetName} at: ${assetInfo.url}`
      );
      fetch(assetInfo.url, { method: "HEAD" })
        .then((response) => {
          if (!response.ok) {
            console.error(
              `Error: File ${assetName} is not accessible at ${assetInfo.url}`
            );
            return resolve({
              success: false,
              error: `Audio file inaccessible: ${assetInfo.url} (Status: ${response.status})`,
            });
          }

          console.log(
            `File ${assetName} is accessible, starting load into Phaser`
          );
          this.scene.load.audio(assetName, assetInfo.url);

          this.scene.load.once("complete", () => {
            console.log(
              `Loading ${assetName} completed, registering in sound manager`
            );
            const sound = this.scene.sound.add(assetName); // רישום ידני
            if (!sound) {
              console.error(
                `Error: ${assetName} failed to register in Phaser's sound manager`
              );
              resolve({
                success: false,
                error: `Sound ${assetName} failed to register in Phaser sound manager`,
              });
              return;
            }
            this.loadedAssets.add(assetName);
            this.assetsMap.set(assetName, { ...assetInfo });
            console.log(
              `Success: Audio ${assetName} loaded and registered successfully`
            );
            resolve({ success: true });
          });

          this.scene.load.once("loaderror", (file: Phaser.Loader.File) => {
            console.error(`Error loading file ${assetName}: ${file.url}`);
            resolve({
              success: false,
              error: `Failed to load sound ${assetName}: ${file.url}`,
            });
          });

          console.log(`Starting loading process for ${assetName}`);
          this.scene.load.start();
          console.log(`Loaded audio with key: ${assetName}`);
        })
        .catch((error) => {
          console.error(`Error accessing file ${assetName}: ${error}`);
          resolve({
            success: false,
            error: `Failed to fetch audio ${assetName}: ${error}`,
          });
        });
    });
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
          case "text":
            const textInfo = assetInfo as TextAssetInfo;
            assetExists = document.fonts.check(`1em ${textInfo.fontFamily}`);
            break;
          case "audio":
            assetExists = !!this.scene.sound.get(result.assetName);
            break;
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

        if (!assetExists && assetInfo.type !== "spine") {
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

      const validTypes = [
        "image",
        "video",
        "particle",
        "spine",
        "audio",
        "text",
      ];
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

      // Skip URL validation for system fonts
      const isSystemFont =
        asset.assetType === "text" &&
        asset.fontFamily &&
        this.isSystemFont(asset.fontFamily);

      if (!asset.assetUrl && !isSystemFont) {
        console.log(`AssetService: ${assetPrefix} - 'assetUrl' is missing`);
        errors.push(`${assetPrefix}: 'assetUrl' is missing`);
      } else if (asset.assetType === "spine") {
        // Existing spine validation code...
        // This part remains unchanged
        if (typeof asset.assetUrl !== "object" || asset.assetUrl === null) {
          errors.push(
            `${assetPrefix}: For spine assets, 'assetUrl' must be an object with skeletonUrl and atlasUrl properties`
          );
        } else {
          // Remaining spine validation code...
        }
      } else if (!isSystemFont) {
        // Skip URL validation for system fonts
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
            // Remaining URL validation code...
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
              "wav",
              "mp3",
              "ogg",
              "ttf",
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

    // List of common system fonts

    for (const asset of assets) {
      const assetPrefix = `Asset '${asset.assetName}'`;

      // Skip URL checks for system fonts
      if (
        asset.assetType === "text" &&
        asset.fontFamily &&
        this.isSystemFont(asset.fontFamily)
      ) {
        console.log(
          `AssetService: ${assetPrefix} - Skipping URL check for system font ${asset.fontFamily}`
        );
        continue;
      }

      // Original code continues from here
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
  /**
   * Display results of asset loading and created elements
   */
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

  //this function doesnt working yet, for future use
  public handleResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void {
    console.log(
      `Resolution changed from ${oldWidth}x${oldHeight} to ${newWidth}x${newHeight}`
    );

    // Update formerScreenScale for future reference
    this.formerScreenScale = { x: newWidth, y: newHeight };

    // Calculate the ratio relative to the initial resolution
    const widthRatio = newWidth / this.initialWidth;
    const heightRatio = newHeight / this.initialHeight;

    // Iterate over all elements in elementsMap
    this.elementsMap.forEach((element, elementName) => {
      const sprite = element.sprite;
      if (!sprite) {
        console.log(`No sprite found for element ${elementName}`);
        return; // Skip if there's no sprite
      }

      // Use original relative positions, default to 0.5 (center) if not set
      const originalRelativeX = element.originalRelativeX ?? 0.5;
      const originalRelativeY = element.originalRelativeY ?? 0.5;
      const originalScale = element.originalScale ?? 1;

      // Calculate new position based on original relative position and new resolution
      const newX = originalRelativeX * newWidth;
      const newY = originalRelativeY * newHeight;

      // Calculate new scale based on original scale and initial resolution
      const newScaleX = originalScale * widthRatio;
      const newScaleY = originalScale * heightRatio;
      const newScale = Math.min(newScaleX, newScaleY);

      // Update sprite properties
      sprite.setPosition(newX, newY);
      sprite.setScale(newScale);

      console.log(
        `Updated ${elementName}: Position (${newX}, ${newY}), Scale: ${newScale}`
      );
    });
  }
}
