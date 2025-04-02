import { IAnimatable } from "./Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "./types";

export abstract class BaseAnimation implements IAnimatable {
  currentTween: any;
  constructor(
    protected scene: Phaser.Scene,
    protected target: AnimatableGameObject
  ) {}

  abstract play(config: AnimationConfig): Promise<void>;

  pause(): void {
    this.currentTween?.pause();
  }

  resume(): void {
    this.currentTween?.resume();
  }

  stop(): void {
    this.currentTween?.stop();
  }

  reset(): void {
    this.currentTween?.stop();
  }
}
