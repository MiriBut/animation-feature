import { TimelineElement } from "../../types/interfaces/TimelineInterfaces";
import { AssetElement } from "../../types/interfaces/AssetInterfaces";
import { Scene, GameObjects } from "phaser";

export class AnimationService {
  private scene: Scene;
  private debugPoints: Map<string, GameObjects.Graphics> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
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

    // console.log(
    //   "Full Timeline Element:",
    //   JSON.stringify(timelineElement, null, 2)
    // );
    // console.log("onScreen value type:", typeof timelineElement.onScreen);
    // console.log("onScreen value:", timelineElement.onScreen);

    const timeline = timelineElement.timeline;

    const pivotContainer = this.createPivotContainer(gameObject, assetElement);
    // this.addPivotDebugPoint(
    //   timelineElement.elementName,
    //   pivotContainer.x,
    //   pivotContainer.y
    // );

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
      timeline.position.forEach((anim) => {
        if ("z" in anim.startValue || "z" in anim.endValue) {
          const startZ = anim.startValue.z ?? gameObject.depth;
          const endZ = anim.endValue.z ?? gameObject.depth;

          this.scene.tweens.add({
            targets: pivotContainer,
            depth: { from: startZ, to: endZ },
            duration: (anim.endTime - anim.startTime) * 1000,
            ease: anim.easeIn || "Linear",
            delay: anim.startTime * 1000,
          });
        }

        // Handle regular x,y position animation
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
      });
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
    if (timelineElement.onScreen) {
      console.log("onScreen found for:", timelineElement.elementName);
      // קודם כל נאפס את האלמנט להיות שקוף
      gameObject.setAlpha(0);

      timelineElement.onScreen.forEach((screen) => {
        console.log("Processing screen time range:", screen);

        // אנימציית הופעה
        this.scene.tweens.add({
          targets: gameObject,
          alpha: 1, // לשנות ל-1 במקום {from: 0, to: 1}
          duration: 100, // משך קצר לאפקט הופעה חלק
          ease: "Linear",
          delay: screen.startTime * 1000, // זמן התחלה
        });

        // אנימציית היעלמות
        this.scene.tweens.add({
          targets: gameObject,
          alpha: 0, // לשנות ל-0 במקום {from: 1, to: 0}
          duration: 100, // משך קצר לאפקט היעלמות חלק
          ease: "Linear",
          delay: screen.endTime * 1000, // זמן סיום ישיר, לא יחסי
        });
      });
    } else {
      gameObject.setAlpha(1);
    }
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

  // public cleanupDebugPoints(): void {
  //   this.debugPoints.forEach((point) => point.destroy());
  //   this.debugPoints.clear();
  // }
}
