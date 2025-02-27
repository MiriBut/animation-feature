import { AnimationRegistry } from "../AnimationRegistory";
import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";
import { ColorAnimation } from "./ColorAnimation";
import { OpacityAnimation } from "./OpacityAnimation";
import { PositionAnimation } from "./PositionAnimation";
import { RotationAnimation } from "./RotationAnimation";
import { ScaleAnimation } from "./ScaleAnimation";

// Register all animations
const registry = AnimationRegistry.getInstance();
registry.register("position", PositionAnimation);
registry.register("scale", ScaleAnimation);
registry.register("opacity", OpacityAnimation);
registry.register("rotation", RotationAnimation);
registry.register("color", ColorAnimation);
export { PositionAnimation };
export { ScaleAnimation };
export { OpacityAnimation };
export { RotationAnimation };
export { ColorAnimation };
