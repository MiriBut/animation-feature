import { IAnimatable, ParticleConfig, AnimatableGameObject } from "../types";

export class ParticleEffectAnimation implements IAnimatable {
  private particleManager?: Phaser.GameObjects.Particles.ParticleEmitter;
  private isActive: boolean = false;

  constructor(
    private scene: Phaser.Scene,
    private target: AnimatableGameObject
  ) {
    if (!("x" in target) || !("y" in target)) {
      throw new Error(
        "ParticleEffectAnimation requires a target with x and y properties"
      );
    }
  }

  async play(config: ParticleConfig): Promise<void> {
    if (!("x" in this.target) || !("y" in this.target)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.stop();

      const targetWithPosition = this.target as unknown as {
        x: number;
        y: number;
      };

      // Use config.emitterConfig if provided, otherwise build from config
      const emitterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
        config.emitterConfig || {
          quantity: config.quantity || 10,
          frequency: config.frequency || 100,
          gravityY: config.gravityY || 0,
          blendMode: config.blendMode || "ADD",
        };

      // Verify texture exists
      const texture = config.texture || "sparkles";
      if (!this.scene.textures.exists(texture)) {
        console.warn(
          `Texture ${texture} not found. Using default 'red' texture.`
        );
        emitterConfig.texture = "blue"; // Fallback to built-in Phaser texture
      } else {
        emitterConfig.texture = texture;
      }

      // Handle lifespan
      if (config.lifespan) {
        if (typeof config.lifespan === "object") {
          const lifespanObj = config.lifespan as { min?: number; max?: number };
          if (lifespanObj.min !== undefined || lifespanObj.max !== undefined) {
            emitterConfig.lifespan = {
              min: lifespanObj.min || 1000,
              max: lifespanObj.max || 2000,
            };
          }
        } else if (typeof config.lifespan === "number") {
          emitterConfig.lifespan = config.lifespan;
        }
      } else if (!emitterConfig.lifespan) {
        emitterConfig.lifespan = { min: 1500, max: 2500 };
      }

      // Handle speed
      if (config.speed) {
        if (typeof config.speed === "object") {
          const speedObj = config.speed as { min?: number; max?: number };
          if (speedObj.min !== undefined || speedObj.max !== undefined) {
            emitterConfig.speed = {
              min: speedObj.min || 50,
              max: speedObj.max || 200,
            };
          }
        } else if (typeof config.speed === "number") {
          emitterConfig.speed = config.speed;
        }
      } else if (!emitterConfig.speed) {
        emitterConfig.speed = { min: 50, max: 200 };
      }

      // Handle angle
      if (config.angle) {
        if (typeof config.angle === "object") {
          const angleObj = config.angle as { min?: number; max?: number };
          if (angleObj.min !== undefined || angleObj.max !== undefined) {
            emitterConfig.angle = {
              min: angleObj.min || 0,
              max: angleObj.max || 360,
            };
          }
        } else if (typeof config.angle === "number") {
          emitterConfig.angle = config.angle;
        }
      } else if (!emitterConfig.angle) {
        emitterConfig.angle = { min: 0, max: 360 };
      }

      // Handle scale
      if (config.scale) {
        if (typeof config.scale === "object") {
          const scaleObj = config.scale as {
            start?: number | { min?: number; max?: number };
            end?: number;
          };
          if (scaleObj.start !== undefined && scaleObj.end !== undefined) {
            if (typeof scaleObj.start === "object") {
              const startObj = scaleObj.start as { min?: number; max?: number };
              emitterConfig.scale = {
                start:
                  startObj.min !== undefined && startObj.max !== undefined
                    ? { min: startObj.min, max: startObj.max }
                    : 1,
                end: typeof scaleObj.end === "number" ? scaleObj.end : 0,
              } as any;
            } else {
              emitterConfig.scale = {
                start: typeof scaleObj.start === "number" ? scaleObj.start : 1,
                end: typeof scaleObj.end === "number" ? scaleObj.end : 0,
              };
            }
          } else {
            emitterConfig.scale = 1;
          }
        } else if (typeof config.scale === "number") {
          emitterConfig.scale = config.scale;
        }
      } else if (!emitterConfig.scale) {
        emitterConfig.scale = { start: 1, end: 0 };
      }

      // Handle alpha
      if (config.alpha) {
        if (
          typeof config.alpha === "object" &&
          "start" in config.alpha &&
          "end" in config.alpha
        ) {
          const alphaObj = config.alpha as { start: number; end: number };
          emitterConfig.alpha = {
            start: alphaObj.start,
            end: alphaObj.end,
          };
        } else if (typeof config.alpha === "number") {
          emitterConfig.alpha = config.alpha;
        }
      } else if (!emitterConfig.alpha) {
        emitterConfig.alpha = { start: 1, end: 0 };
      }

      // Handle rotate
      if (config.rotate) {
        if (typeof config.rotate === "object") {
          const rotateObj = config.rotate as { min?: number; max?: number };
          if (rotateObj.min !== undefined || rotateObj.max !== undefined) {
            emitterConfig.rotate = {
              min: rotateObj.min !== undefined ? rotateObj.min : 0,
              max: rotateObj.max !== undefined ? rotateObj.max : 0,
            } as any;
          }
        } else if (typeof config.rotate === "number") {
          emitterConfig.rotate = config.rotate;
        }
      } else if (!emitterConfig.rotate) {
        emitterConfig.rotate = 0;
      }

      // Helper function to parse color values (string or number) to number
      const parseColorValue = (value: string | number): number => {
        if (typeof value === "number") {
          return value;
        }
        const cleanValue = value.startsWith("0x") ? value.substring(2) : value;
        try {
          const parsed = parseInt(cleanValue, 16);
          return isNaN(parsed) ? 0x0000ff : parsed; // Fallback to blue if invalid
        } catch (e) {
          console.warn(`Invalid color value: ${value}. Using default blue.`);
          return 0x0000ff;
        }
      };

      if (config.emitZone) {
        // If emitZone is an object with type property
        if (typeof config.emitZone === "object" && "type" in config.emitZone) {
          const zoneConfig = config.emitZone as {
            type: string;
            width?: number;
            height?: number;
            radius?: number;
            quantity?: number;
            source?: any;
            x?: number;
            y?: number;
          };

          const offsetX = zoneConfig.x || 0;
          const offsetY = zoneConfig.y || 0;

          // Handle rectangular zone
          if (zoneConfig.type === "rect" || zoneConfig.type === "rectangle") {
            const width = zoneConfig.width || 100;
            const height = zoneConfig.height || 100;

            emitterConfig.emitZone = {
              type: "random",
              source: new Phaser.Geom.Rectangle(
                -width / 2 + offsetX,
                -height / 2 + offsetY,
                width,
                height
              ),
              quantity: zoneConfig.quantity || 10,
            };
          }
        }
      } else {
      }

      // Handle tint
      if (config.tint) {
        if (Array.isArray(config.tint)) {
          // Handle array of colors
          emitterConfig.tint = config.tint.map((tintValue) =>
            parseColorValue(tintValue)
          );
        } else {
          // Handle single tint value
          emitterConfig.tint = parseColorValue(config.tint as string | number);
        }
      } else if (config.color) {
        // Fallback to color property
        emitterConfig.tint = parseColorValue(config.color);
      } else {
        // Default to blue if no tint or color provided
        emitterConfig.tint = [0x0000ff];
      }

      // Create particle emitter
      this.particleManager = this.scene.add.particles(
        targetWithPosition.x,
        targetWithPosition.y,
        emitterConfig.texture,
        emitterConfig
      );

      // Make sure the emitter follows the target
      if (this.particleManager) {
        this.particleManager.startFollow(targetWithPosition);
      }

      // Mark as active
      this.isActive = true;

      // Resolve after duration
      this.scene.time.delayedCall(config.duration || 2000, () => {
        this.stop();
        resolve();
      });
    });
  }

  pause(): void {
    if (this.particleManager && this.isActive) {
      this.particleManager.pause();
    }
  }

  resume(): void {
    if (this.particleManager && this.isActive) {
      this.particleManager.resume();
    }
  }

  stop(): void {
    if (this.particleManager) {
      this.particleManager.stop();
      this.particleManager.killAll();
      this.particleManager.destroy();
      this.particleManager = undefined;
      this.isActive = false;
    }
  }

  reset(): void {
    this.stop();
  }
}
