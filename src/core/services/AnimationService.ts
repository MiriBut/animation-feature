import { Scene } from "phaser";

export class AnimationService {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public applyAnimations(gameObject: any, timeline: any): void {
    if (!timeline) return;

    if (timeline.scale) {
      const anim = timeline.scale[0]; // לוקח את האנימציה הראשונה
      if (anim) {
        this.scene.tweens.add({
          targets: gameObject,
          scaleX: anim.endValue.x,
          scaleY: anim.endValue.y,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
        });
      }
    }

    if (timeline.position) {
      const anim = timeline.position[0];
      if (anim) {
        this.scene.tweens.add({
          targets: gameObject,
          x: anim.endValue.x,
          y: anim.endValue.y,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
        });
      }
    }

    if (timeline.opacity) {
      const anim = timeline.opacity[0];
      if (anim) {
        this.scene.tweens.add({
          targets: gameObject,
          alpha: anim.endValue,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
        });
      }
    }

    if (timeline.rotation) {
      const anim = timeline.rotation[0];
      if (anim) {
        this.scene.tweens.add({
          targets: gameObject,
          angle: anim.endValue,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
        });
      }
    }

    if (timeline.color) {
      const anim = timeline.color[0];
      if (anim) {
        // קבע את הצבע ההתחלתי
        const startColor = parseInt(anim.startValue.replace("0x", ""), 16);
        const endColor = parseInt(anim.endValue.replace("0x", ""), 16);

        gameObject.setTint(startColor);

        // צור אנימציית צבע
        this.scene.tweens.add({
          targets: {}, // dummy target
          tint: { from: 0, to: 1 }, // נשתמש בזה כפרוגרס
          duration: (anim.endTime - anim.startTime) * 1000,
          delay: anim.startTime * 1000,
          ease: anim.easeIn || "Linear",
          onUpdate: (tween) => {
            const value = tween.getValue();
            const r1 = (startColor >> 16) & 0xff;
            const g1 = (startColor >> 8) & 0xff;
            const b1 = startColor & 0xff;

            const r2 = (endColor >> 16) & 0xff;
            const g2 = (endColor >> 8) & 0xff;
            const b2 = endColor & 0xff;

            const r = Math.floor(r1 + (r2 - r1) * value);
            const g = Math.floor(g1 + (g2 - g1) * value);
            const b = Math.floor(b1 + (b1 - b1) * value);

            const currentColor = (r << 16) | (g << 8) | b;
            gameObject.setTint(currentColor);
          },
        });
      }
    }
  }
}
