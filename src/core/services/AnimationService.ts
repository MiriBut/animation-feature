import { Scene } from "phaser";
import {
  TimelineElement,
  TimelineAnimation,
} from "../../types/interfaces/TimelineInterfaces";

export class AnimationService {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public applyAnimations(element: TimelineElement, gameObject: any): void {
    if (!element.timeline) return;

    // טיפול בכל סוגי האנימציות
    this.applyColorAnimations(element.timeline.color, gameObject);
    this.applyPositionAnimations(element.timeline.position, gameObject);
    this.applyScaleAnimations(element.timeline.scale, gameObject);
    this.applyOpacityAnimations(element.timeline.opacity, gameObject);
    this.applyRotationAnimations(element.timeline.rotation, gameObject);
  }

  private applyColorAnimations(
    colorAnimations?: TimelineAnimation[],
    gameObject?: any
  ): void {
    if (!colorAnimations || !gameObject) return;

    colorAnimations.forEach((anim) => {
      this.scene.tweens.add({
        targets: gameObject,
        tint: {
          from: parseInt(anim.startValue),
          to: parseInt(anim.endValue),
        },
        duration: (anim.endTime - anim.startTime) * 1000, // המרה למילישניות
        ease: anim.easeIn,
        delay: anim.startTime * 1000,
      });
    });
  }

  private applyPositionAnimations(
    positionAnimations?: TimelineAnimation[],
    gameObject?: any
  ): void {
    if (!positionAnimations || !gameObject) return;

    positionAnimations.forEach((anim) => {
      console.log(
        `${anim.startValue.elementName} - Starting position animation: ` +
          `X: ${anim.startValue.x} -> ${anim.endValue.x}, ` +
          `Y: ${anim.startValue.y} -> ${anim.endValue.y}`
      );

      this.scene.tweens.add({
        targets: gameObject,
        x: { from: anim.startValue.x, to: anim.endValue.x },
        y: { from: anim.startValue.y, to: anim.endValue.y },
        duration: (anim.endTime - anim.startTime) * 1000,
        ease: anim.easeIn,
        delay: anim.startTime * 1000,
      });
    });
  }

  private applyScaleAnimations(
    scaleAnimations?: TimelineAnimation[],
    gameObject?: any
  ): void {
    if (!scaleAnimations || !gameObject) return;

    scaleAnimations.forEach((anim) => {
      this.scene.tweens.add({
        targets: gameObject,
        scaleX: { from: anim.startValue.x, to: anim.endValue.x },
        scaleY: { from: anim.startValue.y, to: anim.endValue.y },
        duration: (anim.endTime - anim.startTime) * 1000,
        ease: anim.easeIn,
        delay: anim.startTime * 1000,
      });
    });
  }

  private applyOpacityAnimations(
    opacityAnimations?: TimelineAnimation[],
    gameObject?: any
  ): void {
    if (!opacityAnimations || !gameObject) return;

    opacityAnimations.forEach((anim) => {
      this.scene.tweens.add({
        targets: gameObject,
        alpha: { from: anim.startValue, to: anim.endValue },
        duration: (anim.endTime - anim.startTime) * 1000,
        ease: anim.easeIn,
        delay: anim.startTime * 1000,
      });
    });
  }

  private applyRotationAnimations(
    rotationAnimations?: TimelineAnimation[],
    gameObject?: any
  ): void {
    if (!rotationAnimations || !gameObject) return;

    rotationAnimations.forEach((anim) => {
      this.scene.tweens.add({
        targets: gameObject,
        rotation: {
          from: anim.startValue * (Math.PI / 180), // המרה למעלות
          to: anim.endValue * (Math.PI / 180),
        },
        duration: (anim.endTime - anim.startTime) * 1000,
        ease: anim.easeIn,
        delay: anim.startTime * 1000,
      });
    });
  }
}
