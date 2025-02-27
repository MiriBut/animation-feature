import { AnimationConfig } from "./types";

export interface IAnimatable {
  play(config: AnimationConfig): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
}
