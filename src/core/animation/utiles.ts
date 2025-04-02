import { SpineGameObject } from "@esotericsoftware/spine-phaser/dist";
import { AudioAnimation, SpineAnimation } from "./animations";
import { AnimatableGameObject } from "./types";

export function isAnimatable(obj: unknown): obj is AnimatableGameObject {
  return (
    obj !== null &&
    typeof obj === "object" &&
    (obj instanceof Phaser.GameObjects.Sprite ||
      obj instanceof Phaser.GameObjects.Image ||
      obj instanceof Phaser.GameObjects.Video ||
      obj instanceof Phaser.GameObjects.Container ||
      obj instanceof SpineGameObject ||
      obj instanceof AudioAnimation)
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
