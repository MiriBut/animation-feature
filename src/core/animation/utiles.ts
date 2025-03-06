import { SpineAnimation } from "./animations";
import { AnimatableGameObject } from "./types";

export function isAnimatable(
  obj: Phaser.GameObjects.GameObject
): obj is AnimatableGameObject {
  return (
    obj instanceof Phaser.GameObjects.Sprite ||
    obj instanceof Phaser.GameObjects.Image ||
    obj instanceof Phaser.GameObjects.Video ||
    obj instanceof SpineAnimation
  );
}

export class ObjectIdGenerator {
  private static counter = 0;
  private static objectIds = new WeakMap<
    Phaser.GameObjects.GameObject,
    string
  >();

  static getId(target: Phaser.GameObjects.GameObject): string {
    let id = this.objectIds.get(target);
    if (!id) {
      id = `${target.type}_${++this.counter}`;
      this.objectIds.set(target, id);
    }
    return id;
  }
}
