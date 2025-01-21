import { Scene } from "phaser";
import { SpineGameObject, SpinePlugin } from "@esotericsoftware/spine-phaser";

interface SpineAssetConfig {
  key: string;
  skeletonURL: string;
  atlasURL: string;
  type: "binary" | "json";
}

export class CharacterManager {
  private scene: Scene;
  private spineCharacter: SpineGameObject | null = null;
  private assetsLoaded: boolean = false;
  private assetConfig: SpineAssetConfig | null = null;
  private moveSpeed: number = 200;
  private isMoving: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
    console.log("CharacterManager initialized");
  }

  preload(): void {
    this.scene.load.once("complete", () => {
      console.log("All assets loaded successfully");
      this.assetsLoaded = true;
    });

    console.log("CharacterManager preload started");

    this.scene.load.on("loaderror", (file: any) => {
      console.error("Error loading asset:", file.src);
    });
  }

  create(): void {
    if (!this.assetConfig || !this.assetsLoaded) {
      console.error(
        "Asset configuration not available or assets not yet loaded"
      );
      return;
    }

    console.log("CharacterManager create started");

    try {
      this.spineCharacter = this.scene.add.spine(
        this.scene.scale.width + 100,
        this.scene.scale.height - 100,
        this.assetConfig.key,
        `${this.assetConfig.key}Atlas`
      );

      this.playAllSpineAnimationInLoop();
    } catch (error) {
      console.error("Error creating spine character:", error);
    }
  }

  private playAllSpineAnimationInLoop() {
    const animations =
      this.spineCharacter?.animationState?.data?.skeletonData?.animations;

    if (animations) {
      const animationNames = animations.map((animation: any) => animation.name);

      if (animationNames.length > 0) {
        console.log("All animations:", animationNames);

        animationNames.forEach((animationName, index) => {
          setTimeout(() => {
            console.log("Playing animation:", animationName);
            this.spineCharacter?.animationState.setAnimation(
              0,
              animationName,
              true
            );
          }, index * 2000);
        });
      } else {
        console.warn("No animations found");
      }
    } else {
      console.error("No animations available");
    }

    this.spineCharacter?.setScale(0.5);
    this.spineCharacter?.setDepth(1);

    console.log("Spine character updted successfully");

    this.startMovement();
  }

  loadSpineAsset(config: SpineAssetConfig): void {
    this.assetConfig = config;
    console.log(`Loading Spine asset: ${config.key} (${config.type} format)`);

    this.scene.load.once("complete", () => {
      console.log("All assets loaded successfully");
      this.assetsLoaded = true;
    });

    this.scene.load.on("loaderror", (file: any) => {
      console.error("Error loading asset:", file);
    });

    const texturePath = config.atlasURL.replace(".atlas", ".png");
    console.log("Loading texture from:", texturePath);
    this.scene.load.image(config.key, texturePath);

    if (config.type === "binary") {
      console.log("Loading binary skeleton:", config.skeletonURL);
      this.scene.load.spineBinary(config.key, config.skeletonURL);
    } else {
      console.log("Loading JSON skeleton:", config.skeletonURL);
      this.scene.load.spineJson(config.key, config.skeletonURL);
    }

    console.log("Loading atlas:", config.atlasURL);
    this.scene.load.spineAtlas(`${config.key}Atlas`, config.atlasURL);
  }

  private startMovement(): void {
    if (!this.spineCharacter || this.isMoving) return;
    this.isMoving = true;
    this.scene.events.on("update", this.updateCharacterPosition, this);
  }

  private updateCharacterPosition(): void {
    if (!this.spineCharacter) return;

    this.spineCharacter.x +=
      this.moveSpeed * (this.scene.game.loop.delta / 1000);

    if (this.spineCharacter.x > this.scene.scale.width + 100) {
      this.spineCharacter.x = -100;
    }
  }

  private checkCharacterExists(): boolean {
    if (!this.spineCharacter) {
      console.warn("No spine character available");
      return false;
    }
    return true;
  }

  async changeCharacter(
    skelFile: File,
    atlasFile: File,
    pngFiles: File[]
  ): Promise<void> {
    try {
      const key = `user-character-${Date.now()}`;

      console.log("Files received:", {
        skel: skelFile.name,
        atlas: atlasFile.name,
        pngs: pngFiles.map((f) => f.name),
      });

      const skelURL = URL.createObjectURL(skelFile);
      const atlasURL = URL.createObjectURL(atlasFile);

      const pngMap = new Map(
        pngFiles.map((file) => {
          const url = URL.createObjectURL(file);
          console.log(`Mapping ${file.name} to ${url}`);
          return [file.name, url];
        })
      );

      const prevX = this.spineCharacter?.x ?? this.scene.scale.width + 100;
      const prevY = this.spineCharacter?.y ?? this.scene.scale.height / 2;

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
        this.spineCharacter = this.scene.add.spine(
          prevX,
          prevY,
          key,
          `${key}Atlas`
        );

        if (this.spineCharacter) {
          this.playAllSpineAnimationInLoop();
        }
      }

      URL.revokeObjectURL(skelURL);
      URL.revokeObjectURL(atlasURL);
      pngMap.forEach((url) => URL.revokeObjectURL(url));
    } catch (error) {
      console.error("Error changing character:", error);
      throw error;
    }
  }

  destroy(): void {
    if (this.checkCharacterExists()) {
      this.spineCharacter!.destroy;
    }
  }
}
