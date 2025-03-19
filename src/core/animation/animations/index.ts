import { AnimationRegistry } from "../AnimationRegistory";
import { PositionAnimation } from "./PositionAnimation";
import { ScaleAnimation } from "./ScaleAnimation";
import { OpacityAnimation } from "./OpacityAnimation";
import { RotationAnimation } from "./RotationAnimation";
import { ColorAnimation } from "./ColorAnimation";
import { SpineAnimation } from "./SpineAnimation";
import { AudioAnimation } from "./AudioAnimation";
import { TextAnimation } from "./TextAnimation";

// Register all animations
const registry = AnimationRegistry.getInstance();
registry.register("position", PositionAnimation);
registry.register("scale", ScaleAnimation);
registry.register("opacity", OpacityAnimation);
registry.register("rotation", RotationAnimation);
registry.register("color", ColorAnimation);
registry.register("spine", SpineAnimation);
registry.register("audio", AudioAnimation);
registry.register("text", TextAnimation);

export { PositionAnimation };
export { ScaleAnimation };
export { OpacityAnimation };
export { RotationAnimation };
export { ColorAnimation };
export { SpineAnimation };
export { AudioAnimation };
export { TextAnimation };
