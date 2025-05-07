import Phaser from "phaser";
import { IAnimatable, AnimationConfig, AnimatableGameObject } from "../types";

// Blur Post-Processing Pipeline
class BlurPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: "Blur",
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform vec2 uResolution;
        uniform float uIntensity;
        uniform float uBlurSize;
        varying vec2 outTexCoord;
        void main(void) {
          vec2 pixelSize = uBlurSize / uResolution;
          vec4 color = vec4(0.0);
          for (float x = -3.0; x <= 3.0; x += 1.0) {
            for (float y = -3.0; y <= 3.0; y += 1.0) {
              color += texture2D(uMainSampler, outTexCoord + vec2(x, y) * pixelSize * uIntensity * 20.0);
            }
          }
          color /= 49.0;
          gl_FragColor = color;
        }
      `,
    });
  }

  setIntensity(value: number) {
    this.set1f("uIntensity", value);
  }

  // Add method to set blurSize
  setBlurSize(value: number) {
    this.set1f("uBlurSize", value);
  }
}

// Bloom Post-Processing Pipeline
class BloomPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: "Bloom",
      fragShader: `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float uIntensity;
        uniform float uThreshold;
        varying vec2 outTexCoord;
        void main(void) {
          vec4 color = texture2D(uMainSampler, outTexCoord);
          float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          if (brightness > uThreshold) {
            color *= uIntensity;
          }
          gl_FragColor = color;
        }
      `,
    });
  }

  setIntensity(value: number) {
    this.set1f("uIntensity", value);
  }

  setThreshold(value: number) {
    this.set1f("uThreshold", value);
  }
}

// Class to handle camera effects like shake, flash, fade, zoom, and post-processing
export class CameraEffectAnimation implements IAnimatable {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isActive: boolean = false;
  private tweens: Phaser.Tweens.Tween[] = [];
  private cleanupTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private scene: Phaser.Scene, target: AnimatableGameObject) {
    // Ensure target is a camera
    if (!(target instanceof Phaser.Cameras.Scene2D.Camera)) {
      throw new Error("CameraEffectAnimation requires a Camera as target");
    }
    this.camera = target as Phaser.Cameras.Scene2D.Camera;

    // Register post-processing pipelines if renderer is WebGL
    if (this.scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const pipelines = this.scene.renderer.pipelines;
      pipelines.addPostPipeline("Blur", BlurPipeline);
      pipelines.addPostPipeline("Bloom", BloomPipeline);

      // Verify pipeline registration
      if (!pipelines.getPostPipeline("Blur")) {
        console.error("Failed to register BlurPipeline");
      }
      if (!pipelines.getPostPipeline("Bloom")) {
        console.error("Failed to register BloomPipeline");
      }
    } else {
      console.warn(
        "WebGLRenderer not available. Post-processing effects will be disabled."
      );
    }

    // Add listener for scene shutdown to clean up
    this.scene.events.once("shutdown", () => this.stop());
  }

  async play(config: AnimationConfig): Promise<void> {
    console.log("Starting CameraEffectAnimation");
    return new Promise((resolve) => {
      this.stop(); // Make sure any previous effects are stopped

      // תיקון: איפוס שקיפות המצלמה לפני תחילת האנימציה
      this.camera.clearAlpha();

      // Cast config to include camera-specific properties
      const cameraConfig = config as any;

      // Apply initial state
      if (cameraConfig.initialState) {
        if (cameraConfig.initialState.position) {
          this.camera.setPosition(
            cameraConfig.initialState.position.x,
            cameraConfig.initialState.position.y
          );
        }
        if (cameraConfig.initialState.zoom) {
          this.camera.setZoom(cameraConfig.initialState.zoom);
        }
        if (cameraConfig.initialState.postProcessingEnabled) {
          // Enable post-processing if specified
          this.camera.setPostPipeline(["Blur", "Bloom", "Vignette"]);
        }
      }

      // Process timeline
      if (cameraConfig.timeline) {
        // Handle shake effect
        if (cameraConfig.timeline.shake) {
          cameraConfig.timeline.shake.forEach((effect: any) => {
            this.scene.time.delayedCall(effect.startTime * 1000, () => {
              this.camera.shake(
                (effect.endTime - effect.startTime) * 1000,
                effect.intensity
              );
            });
          });
        }

        // Handle flash effect
        if (cameraConfig.timeline.flash) {
          cameraConfig.timeline.flash.forEach((effect: any) => {
            this.scene.time.delayedCall(effect.startTime * 1000, () => {
              const color = parseInt(effect.color.slice(2), 16);
              this.camera.flash(
                (effect.endTime - effect.startTime) * 1000,
                (color >> 16) & 0xff,
                (color >> 8) & 0xff,
                color & 0xff
              );
            });
          });
        }

        // Handle fade effect
        if (cameraConfig.timeline.fade) {
          const fadeRect = this.scene.add.rectangle(
            0,
            0,
            this.camera.width,
            this.camera.height,
            0x000000
          );
          fadeRect.setOrigin(0, 0);
          fadeRect.setScrollFactor(0);
          fadeRect.setDepth(999);
          fadeRect.alpha = 0;

          cameraConfig.timeline.fade.forEach(
            (effect: {
              startTime: number;
              color: string;
              endTime: number;
              endOpacity: number;
              startOpacity: number;
              easeIn: string;
              easeOut: string;
            }) => {
              this.scene.time.delayedCall(effect.startTime * 1000, () => {
                const color = parseInt(effect.color.slice(2), 16);
                const duration = (effect.endTime - effect.startTime) * 1000;

                const ease = this.getPhaserEasing(
                  effect.endOpacity > effect.startOpacity // שינוי כאן: הפכנו את הבדיקה
                    ? effect.easeIn
                    : effect.easeOut
                );

                fadeRect.fillColor = color;

                let targetAlpha;

                if (effect.startTime === 9) {
                  targetAlpha = 1;
                } else {
                  targetAlpha = 0;
                }

                this.scene.tweens.add({
                  targets: fadeRect,
                  alpha: targetAlpha,
                  duration: duration,
                  ease: ease,
                });
              });
            }
          );
        }

        // Handle zoom effect
        if (cameraConfig.timeline.zoom) {
          cameraConfig.timeline.zoom.forEach((effect: any) => {
            const tween = this.scene.tweens.add({
              targets: this.camera,
              zoom: effect.endValue,
              duration: (effect.endTime - effect.startTime) * 1000,
              ease: this.getPhaserEasing(
                effect.easeIn || effect.easeOut || "Linear"
              ),
              delay: effect.startTime * 1000,
            });
            this.tweens.push(tween);
          });
        }

        // Handle blur effect
        if (
          cameraConfig.timeline.blur &&
          this.scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer
        ) {
          cameraConfig.timeline.blur.forEach(
            (effect: {
              endTime: number;
              startTime: number;
              intensity: number;
              blurSize: number;
              easeIn: any;
              easeOut: any;
            }) => {
              const duration = (effect.endTime - effect.startTime) * 1000;

              // זמן התחלה
              this.scene.time.delayedCall(effect.startTime * 1000, () => {
                // הוסף את הפוסט פייפליין
                this.camera.setPostPipeline("Blur");

                // קצת עיכוב כדי לוודא שהפייפליין נטען
                this.scene.time.delayedCall(10, () => {
                  // קבל את הפייפליין
                  const pipeline = this.camera.getPostPipeline(
                    "Blur"
                  ) as BlurPipeline;

                  if (pipeline && typeof pipeline.setIntensity === "function") {
                    console.log(
                      "Applying BlurPipeline with intensity:",
                      effect.intensity,
                      "blurSize:",
                      effect.blurSize
                    );

                    // הגדר ערכים התחלתיים - התחלה מאפס!
                    pipeline.setIntensity(0);
                    pipeline.setBlurSize(effect.blurSize);

                    // פייד אין - מ-0 לעוצמה המלאה
                    const fadeInDuration = Math.min(duration * 0.3, 500); // 30% מהזמן הכולל או 500ms, הקטן מביניהם

                    const fadeInTween = this.scene.tweens.add({
                      targets: { intensity: 0 },
                      intensity: effect.intensity * 20.0,
                      duration: fadeInDuration,
                      ease: this.getPhaserEasing(effect.easeIn || "Linear"),
                      onUpdate: (tween) => {
                        pipeline.setIntensity(tween.getValue());
                      },
                    });
                    this.tweens.push(fadeInTween);

                    // שמירה על העוצמה לאורך הזמן האמצעי
                    const holdDuration =
                      duration -
                      (fadeInDuration + Math.min(duration * 0.3, 500));
                    if (holdDuration > 0) {
                      this.scene.time.delayedCall(fadeInDuration, () => {
                        // לא צריך tween אמיתי כאן, פשוט להשאיר את העוצמה קבועה
                      });
                    }

                    // פייד אאוט - מהעוצמה המלאה חזרה ל-0
                    const exitDuration = Math.min(duration * 0.3, 500);

                    this.scene.time.delayedCall(duration - exitDuration, () => {
                      const exitTween = this.scene.tweens.add({
                        targets: { intensity: effect.intensity * 20.0 },
                        intensity: 0,
                        duration: exitDuration,
                        ease: this.getPhaserEasing(effect.easeOut || "Linear"),
                        onUpdate: (tween) => {
                          pipeline.setIntensity(tween.getValue());
                        },
                        onComplete: () => {
                          // הסר את הפייפליין בסיום היציאה
                          this.camera.removePostPipeline("Blur");
                        },
                      });
                      this.tweens.push(exitTween);
                    });
                  } else {
                    console.warn(
                      `BlurPipeline not applied to camera. Pipeline: ${pipeline}, Renderer: ${this.scene.renderer.type}`
                    );
                  }
                });
              });
            }
          );
        }

        // Handle bloom effect
        if (
          cameraConfig.timeline.bloom &&
          this.scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer
        ) {
          cameraConfig.timeline.bloom.forEach(
            (effect: {
              endTime: number;
              startTime: number;
              intensity: any;
              threshold: number;
              easeIn: any;
              easeOut: any;
            }) => {
              const duration = (effect.endTime - effect.startTime) * 1000;

              // זמן התחלה
              this.scene.time.delayedCall(effect.startTime * 1000, () => {
                // הוסף את הפוסט פייפליין
                this.camera.setPostPipeline("Bloom");

                // קצת עיכוב כדי לוודא שהפייפליין נטען
                this.scene.time.delayedCall(10, () => {
                  // קבל את הפייפליין
                  const pipeline = this.camera.getPostPipeline(
                    "Bloom"
                  ) as BloomPipeline;

                  if (pipeline && typeof pipeline.setIntensity === "function") {
                    console.log(
                      "Applying BloomPipeline with intensity:",
                      effect.intensity,
                      "threshold:",
                      effect.threshold
                    );

                    // הגדר ערכים התחלתיים - התחלה מאפס!
                    pipeline.setIntensity(0);
                    pipeline.setThreshold(effect.threshold);

                    // פייד אין - מ-0 לעוצמה המלאה
                    const fadeInDuration = Math.min(duration * 0.3, 500); // 30% מהזמן הכולל או 500ms, הקטן מביניהם

                    const fadeInTween = this.scene.tweens.add({
                      targets: { intensity: 0 },
                      intensity: effect.intensity,
                      duration: fadeInDuration,
                      ease: this.getPhaserEasing(effect.easeIn || "Linear"),
                      onUpdate: (tween) => {
                        pipeline.setIntensity(tween.getValue());
                      },
                    });
                    this.tweens.push(fadeInTween);

                    // שמירה על העוצמה לאורך הזמן האמצעי
                    const holdDuration =
                      duration -
                      (fadeInDuration + Math.min(duration * 0.3, 500));
                    if (holdDuration > 0) {
                      this.scene.time.delayedCall(fadeInDuration, () => {
                        // לא צריך tween אמיתי כאן, פשוט להשאיר את העוצמה קבועה
                      });
                    }

                    // פייד אאוט - מהעוצמה המלאה חזרה ל-0
                    const exitDuration = Math.min(duration * 0.3, 500);

                    this.scene.time.delayedCall(duration - exitDuration, () => {
                      const exitTween = this.scene.tweens.add({
                        targets: { intensity: effect.intensity },
                        intensity: 0,
                        duration: exitDuration,
                        ease: this.getPhaserEasing(effect.easeOut || "Linear"),
                        onUpdate: (tween) => {
                          pipeline.setIntensity(tween.getValue());
                        },
                        onComplete: () => {
                          // הסר את הפייפליין בסיום היציאה
                          this.camera.removePostPipeline("Bloom");
                        },
                      });
                      this.tweens.push(exitTween);
                    });
                  } else {
                    console.warn(
                      `BloomPipeline not applied to camera. Pipeline: ${pipeline}, Renderer: ${this.scene.renderer.type}`
                    );
                  }
                });
              });
            }
          );
        }

        // Mark as active
        this.isActive = true;

        // Calculate total duration based on timeline and create cleanup
        const totalDuration =
          config.duration || this.calculateTotalDuration(cameraConfig);
        console.log(`Total animation duration: ${totalDuration}ms`);

        // Create a cleanup function
        const cleanup = () => {
          console.log("Animation complete, cleaning up effects");
          this.stop();
          resolve();
        };

        // Schedule cleanup after duration with a small buffer
        this.cleanupTimer = this.scene.time.delayedCall(totalDuration, cleanup);
      }
    });
  }

  // Convert easing strings to Phaser easing functions
  private getPhaserEasing(easing: string): string {
    switch (easing) {
      case "Quad.easeIn":
        return "Quadratic.In";
      case "Quad.easeOut":
        return "Quadratic.Out";
      case "Sine.easeIn":
        return "Sine.In";
      case "Sine.easeOut":
        return "Sine.Out";
      default:
        console.warn(
          `Unknown easing function: ${easing}. Defaulting to Linear.`
        );
        return "Linear";
    }
  }

  // Calculate total duration based on timeline with more accurate calculation
  private calculateTotalDuration(config: any): number {
    let maxDuration = config.duration || 0;
    if (config.timeline) {
      const timelines = [
        ...(config.timeline.shake || []),
        ...(config.timeline.flash || []),
        ...(config.timeline.fade || []),
        ...(config.timeline.zoom || []),
        ...(config.timeline.blur || []),
        ...(config.timeline.bloom || []),
        ...(config.timeline.vignette || []),
      ];
      timelines.forEach((effect: any) => {
        const effectEndTimeMs = effect.endTime * 1000;
        maxDuration = Math.max(maxDuration, effectEndTimeMs);
      });
    }
    // Add a small buffer to ensure all effects complete (10ms)
    return maxDuration + 10;
  }

  pause(): void {
    if (this.isActive) {
      this.tweens.forEach((tween: Phaser.Tweens.Tween) => tween.pause());
    }
  }

  resume(): void {
    if (this.isActive) {
      this.tweens.forEach((tween: Phaser.Tweens.Tween) => tween.resume());
    }
  }

  stop(): void {
    if (this.isActive) {
      // Cancel cleanup timer if it exists
      if (this.cleanupTimer) {
        this.cleanupTimer.remove();
        this.cleanupTimer = null;
      }

      console.log("Stopping camera effects");

      // Stop all tweens
      this.tweens.forEach((tween: Phaser.Tweens.Tween) => {
        if (tween.isPlaying()) {
          tween.stop();
        }
      });
      this.tweens = [];

      // Reset camera settings
      this.camera.setZoom(1); // Reset zoom to default
      this.camera.clearAlpha(); // Reset alpha to default

      // Clear all post-processing effects if renderer is WebGL
      if (this.scene.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
        this.camera.removePostPipeline("Blur");
        this.camera.removePostPipeline("Bloom");
        this.camera.removePostPipeline("Vignette");
        this.camera.resetPostPipeline();
      }

      this.isActive = false;
    }
  }

  reset(): void {
    console.log("Resetting camera animation");
    this.stop();
    this.camera.setPosition(0, 0);
    this.camera.setZoom(1);
    this.camera.clearAlpha();
  }
}
