import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";
import { SpinePlugin } from "@esotericsoftware/spine-phaser";
import "./core/animation/animations";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  transparent: false,
  backgroundColor: "#000000",
  parent: "game-container",
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
  },
  audio: {
    disableWebAudio: false,
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
};

export const game = new Phaser.Game(config);
