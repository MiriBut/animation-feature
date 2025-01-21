import Phaser from "phaser";
import { AnimationScene } from "./scenes/AnimationScene";
import { SpinePlugin } from "@esotericsoftware/spine-phaser";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  transparent: false,
  backgroundColor: "#000000",
  parent: "game-container",
  scene: [AnimationScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
  },

  plugins: {
    scene: [
      {
        key: "SpinePlugin",
        plugin: SpinePlugin,
        mapping: "spine",
      },
    ],
  },
};

export const game = new Phaser.Game(config);
