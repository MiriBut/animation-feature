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
  callbacks: {
    preBoot: (game) => {
      console.log("Game is pre-booting");
    },
    postBoot: (game) => {
      console.log("Game has booted successfully");
    },
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

  // @ts-ignore - התעלם מבדיקת הטיפוס
  failOnMissingWebGL: false,
} as Phaser.Types.Core.GameConfig;

export const game = new Phaser.Game(config);
