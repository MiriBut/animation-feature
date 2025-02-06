import { TimelineElement } from "../../types/interfaces/TimelineInterfaces";
import { AssetElement } from "../../types/interfaces/AssetInterfaces";
import { Scene, GameObjects } from "phaser";

export class AnimationService {
  private scene: Scene;
  private debugPoints: Map<string, GameObjects.Graphics> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  private addPivotDebugPoint(elementName: string, x: number, y: number): void {
    const point = this.scene.add.graphics();
    point.lineStyle(2, 0xff0000);
    point.strokeCircle(0, 0, 5);
    point.moveTo(-10, 0);
    point.lineTo(10, 0);
    point.moveTo(0, -10);
    point.lineTo(0, 10);
    point.setPosition(x, y);
    point.setDepth(1000);
    this.debugPoints.set(elementName, point);
  }

  private updatePivotDebugPoint(
    elementName: string,
    x: number,
    y: number
  ): void {
    const point = this.debugPoints.get(elementName);
    if (point) {
      point.setPosition(x, y);
    }
  }

  private createPivotContainer(
    gameObject: GameObjects.Sprite | GameObjects.Image,
    assetElement?: AssetElement
  ): GameObjects.Container {
    const originalX = gameObject.x;
    const originalY = gameObject.y;
    const originalDepth = gameObject.depth;

    const pivotX = assetElement?.pivot_override?.x || 0.5;
    const pivotY = assetElement?.pivot_override?.y || 0.5;

    const pivotContainer = this.scene.add.container(originalX, originalY);
    pivotContainer.setDepth(originalDepth);
    gameObject.setPosition(-pivotX, -pivotY);
    pivotContainer.add(gameObject);

    return pivotContainer;
  }

  public applyAnimations(
    gameObject: GameObjects.Sprite | GameObjects.Image,
    timelineElement: TimelineElement,
    assetElement?: AssetElement
  ): void {
    if (!timelineElement) return;
    const timeline = timelineElement.timeline;

    const pivotContainer = this.createPivotContainer(gameObject, assetElement);
    this.addPivotDebugPoint(
      timelineElement.elementName,
      pivotContainer.x,
      pivotContainer.y
    );

    if (timeline?.scale) {
      const anim = timeline.scale[0];
      if (anim) {
        this.scene.tweens.add({
          targets: pivotContainer,
          scaleX: anim.endValue.x,
          scaleY: anim.endValue.y,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
          onUpdate: () =>
            this.updatePivotDebugPoint(
              timelineElement.elementName,
              pivotContainer.x,
              pivotContainer.y
            ),
        });
      }
    }

    if (timeline?.position) {
      const anim = timeline.position[0];
      if (anim) {
        this.scene.tweens.add({
          targets: pivotContainer,
          x: anim.endValue.x,
          y: anim.endValue.y,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
          onUpdate: () =>
            this.updatePivotDebugPoint(
              timelineElement.elementName,
              pivotContainer.x,
              pivotContainer.y
            ),
        });
      }
    }

    if (timeline?.opacity) {
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

    if (timeline?.rotation) {
      const anim = timeline.rotation[0];
      if (anim) {
        this.scene.tweens.add({
          targets: pivotContainer,
          angle: anim.endValue,
          duration: (anim.endTime - anim.startTime) * 1000,
          ease: anim.easeIn || "Linear",
          delay: anim.startTime * 1000,
          onUpdate: () =>
            this.updatePivotDebugPoint(
              timelineElement.elementName,
              pivotContainer.x,
              pivotContainer.y
            ),
        });
      }
    }
  }

  public cleanupDebugPoints(): void {
    this.debugPoints.forEach((point) => point.destroy());
    this.debugPoints.clear();
  }
}
