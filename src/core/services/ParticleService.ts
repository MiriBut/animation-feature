import { Scene, GameObjects, Geom } from "phaser";
import { TimelineElement } from "../../types/interfaces/TimelineInterfaces";
import { AssetElement } from "../../types/interfaces/AssetInterfaces";

export class ParticleService {
  private scene: Scene;
  private particles: Map<string, GameObjects.Particles.ParticleEmitter>;

  constructor(scene: Scene) {
    this.scene = scene;
    this.particles = new Map();
  }

  public createParticleSystem(
    timelineElement: TimelineElement,
    assetElement?: AssetElement
  ): GameObjects.Particles.ParticleEmitter | null {
    if (!timelineElement.particles?.config) {
      console.error("Particle config is missing");
      return null;
    }

    try {
      // Log the available textures
      console.log("Available textures:", this.scene.textures.list);

      // Get texture name and log it
      const textureName = timelineElement.particles.textureName;
      console.log("Trying to use texture:", timelineElement.assetName);
      console.log("Asset URL:", assetElement?.assetUrl);

      if (!textureName) {
        console.error(`Missing textureName for ${timelineElement.elementName}`);
        return null;
      }

      // Check if texture exists
      if (!this.scene.textures.exists(timelineElement.assetName)) {
        console.error(
          `Texture ${timelineElement.assetName} not found. Available textures:`,
          Object.keys(this.scene.textures.list)
        );
        return null;
      }

      // Create emitter with config
      const config = this.createEmitterConfig(timelineElement.particles.config);
      console.log(
        "timelineElement.particles.config:",
        JSON.stringify(timelineElement.particles.config, null, 2)
      );
      const emitter = this.scene.add.particles(0, 0, textureName, config);

      // Setup particle system
      this.setupParticleSystem(emitter, timelineElement);

      // Store reference
      this.particles.set(timelineElement.elementName, emitter);

      return emitter;
    } catch (error) {
      console.error("Error creating particle system:", error);
      return null;
    }
  }

  private createEmitterConfig(
    config: any
  ): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
    const emitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
      {
        frequency: config.frequency || 100,
        lifespan: config.lifespan || { min: 1000, max: 2000 },
        quantity: config.quantity || 1,
        speed: config.speed || { min: 50, max: 100 },
        scale: config.scale || { start: 1, end: 0 },
        alpha: config.alpha || { start: 1, end: 0 },
        rotate: config.rotate,
        blendMode: config.blendMode || Phaser.BlendModes.ADD,
        gravityX: config.gravityX || 0,
        gravityY: config.gravityY || 0,
      };

    // Add tint only if it exists and is valid
    if (config.tint && Array.isArray(config.tint)) {
      try {
        emitterConfig.tint = config.tint.map((color: string) =>
          typeof color === "string"
            ? parseInt(color.replace("0x", ""), 16)
            : color
        );
      } catch (error) {
        console.warn("Invalid tint value in particle config:", error);
      }
    }

    // Setup emit zone if specified
    if (config.emitZone) {
      const zoneConfig = config.emitZone;
      let source;

      switch (zoneConfig.type) {
        case "edge":
          source = new Geom.Line(
            zoneConfig.x1 || 0,
            zoneConfig.y1 || 0,
            zoneConfig.x2 || 100,
            zoneConfig.y2 || 0
          );
          break;
        case "random":
        default:
          source = new Geom.Rectangle(
            zoneConfig.x || -10,
            zoneConfig.y || -10,
            zoneConfig.width || 20,
            zoneConfig.height || 20
          );
          break;
      }

      emitterConfig.emitZone = {
        type: zoneConfig.type as "random" | "edge",
        source: source,
        quantity: zoneConfig.quantity || 1,
        stepRate: zoneConfig.stepRate || 0,
        yoyo: zoneConfig.yoyo || false,
      };
    }

    return emitterConfig;
  }

  private setupParticleSystem(
    emitter: GameObjects.Particles.ParticleEmitter,
    timelineElement: TimelineElement
  ): void {
    // Set initial state but don't set position (will be handled by container)
    emitter.setAlpha(1);

    // Handle visibility timing if specified
    if (timelineElement.onScreen && timelineElement.onScreen.length > 0) {
      this.handleParticleVisibility(emitter, timelineElement.onScreen);
    } else {
      // If no onScreen timing, start immediately
      emitter.start();
    }
  }

  private handleParticleVisibility(
    emitter: GameObjects.Particles.ParticleEmitter,
    onScreen: { startTime: number; endTime: number }[]
  ): void {
    // Sort by startTime to ensure proper sequence
    const sortedScreens = [...onScreen].sort(
      (a, b) => a.startTime - b.startTime
    );

    sortedScreens.forEach((screen) => {
      // Convert seconds to milliseconds
      const startDelay = Math.max(0, screen.startTime * 1000);
      const endDelay = Math.max(0, screen.endTime * 1000);

      // Schedule start
      this.scene.time.delayedCall(startDelay, () => {
        emitter.start();
      });

      // Schedule stop
      this.scene.time.delayedCall(endDelay, () => {
        emitter.stop();
      });
    });
  }

  public cleanup(): void {
    this.particles.forEach((emitter) => {
      emitter.stop();
      emitter.destroy();
    });
    this.particles.clear();
  }
}
