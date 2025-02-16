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
      // Load particle texture
      const textureName = timelineElement.particles.textureName;
      if (!textureName) {
        console.error(`Missing textureName for ${timelineElement.elementName}`);
        return null;
      }

      this.scene.load.image("particleTexture", assetElement?.assetUrl);

      // Create emitter with config
      const config = this.createEmitterConfig(timelineElement.particles.config);
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
        frequency: config.frequency,
        lifespan: config.lifespan,
        quantity: config.quantity,
        speed: config.speed,
        scale: config.scale,
        alpha: config.alpha,
        rotate: config.rotate,
        tint: config.tint
          ? config.tint.map((color: string) => parseInt(color.toString(), 16))
          : undefined,
        blendMode: config.blendMode,
        gravityX: config.gravityX,
        gravityY: config.gravityY,
      };

    if (config.emitZone) {
      const line = new Geom.Line(0, 0, 100, 100);
      emitterConfig.emitZone = {
        type: "edge",
        source: line,
        quantity: 1,
        stepRate: 0,
        yoyo: false,
      };
    }

    return emitterConfig;
  }

  private setupParticleSystem(
    emitter: GameObjects.Particles.ParticleEmitter,
    timelineElement: TimelineElement
  ): void {
    // Set initial position
    emitter.setPosition(400, 300);

    // Handle visibility timing if specified
    if (timelineElement.onScreen) {
      this.handleParticleVisibility(emitter, timelineElement.onScreen);
    }

    // Set initial state
    emitter.setAlpha(1);
  }

  private handleParticleVisibility(
    emitter: GameObjects.Particles.ParticleEmitter,
    onScreen: { startTime: number; endTime: number }[]
  ): void {
    onScreen.forEach((screen) => {
      this.scene.time.delayedCall(screen.startTime * 1000, () => {
        emitter.start();
      });
      this.scene.time.delayedCall(screen.endTime * 1000, () => {
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
