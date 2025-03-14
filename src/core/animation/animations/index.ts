import { AnimationRegistry } from "../AnimationRegistory";
import { IAnimatable } from "../Ianimatable";
import { AnimatableGameObject, AnimationConfig } from "../types";
import { PositionAnimation } from "./PositionAnimation";
import { ScaleAnimation } from "./ScaleAnimation";
import { OpacityAnimation } from "./OpacityAnimation";
import { RotationAnimation } from "./RotationAnimation";
import { ColorAnimation } from "./ColorAnimation";
import { SpineAnimation } from "./SpineAnimation";

// Register all animations
const registry = AnimationRegistry.getInstance();
registry.register("position", PositionAnimation);
registry.register("scale", ScaleAnimation);
registry.register("opacity", OpacityAnimation);
registry.register("rotation", RotationAnimation);
registry.register("color", ColorAnimation);
registry.register("spine", SpineAnimation);
//registry.register("spine", SpineAnimation);
export { PositionAnimation };
export { ScaleAnimation };
export { OpacityAnimation };
export { RotationAnimation };
export { ColorAnimation };
export { SpineAnimation };
