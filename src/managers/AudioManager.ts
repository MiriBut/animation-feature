import { Scene } from "phaser";
import { DEFAULT_ASSETS } from "../config/constants";

export class AudioManager {
  private scene: Scene;
  private bgMusic?: Phaser.Sound.BaseSound;
  private audioContext?: AudioContext;
  private mediaStreamDestination?: MediaStreamAudioDestinationNode;
  private audioElement?: HTMLAudioElement;
  private isLoaded: boolean = false;
  private audioSource?: MediaElementAudioSourceNode;
  private isAudioSourceConnected: boolean = false;
  private isMusicPlaying: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  preload(): void {
    this.scene.load.once("complete", () => (this.isLoaded = true));
    this.scene.load.audio(DEFAULT_ASSETS.music.key, DEFAULT_ASSETS.music.path);
  }

  create(): void {
    if (this.isMusicPlaying) return;

    if (!this.isLoaded) {
      console.error("Audio not loaded yet");
      return;
    }

    try {
      // checking if other music is playing
      const soundManager: any = this.scene.sound;
      if (
        soundManager.sounds &&
        soundManager.sounds.some(
          (sound: Phaser.Sound.BaseSound) => sound.isPlaying
        )
      ) {
        console.log("Skipping default music because another sound is playing");
        return;
      }

      this.audioContext = new AudioContext();
      this.mediaStreamDestination =
        this.audioContext.createMediaStreamDestination();

      if (!this.scene.cache.audio.exists(DEFAULT_ASSETS.music.key)) {
        console.error(
          "Audio file not found in cache:",
          DEFAULT_ASSETS.music.key
        );
        return;
      }

      this.bgMusic = this.scene.sound.add(DEFAULT_ASSETS.music.key, {
        loop: true,
        volume: 0.5,
      });

      this.audioElement = new Audio(DEFAULT_ASSETS.music.path);
      this.audioElement.loop = true;

      // Set up audio source connection immediately
      this.setupAudioSource();

      this.bgMusic.play();
      this.audioElement.play();
    } catch (error) {
      console.error("Error in create:", error);
    }

    this.isMusicPlaying = true;
  }

  private setupAudioSource(): void {
    if (
      !this.audioElement ||
      !this.audioContext ||
      !this.mediaStreamDestination ||
      this.isAudioSourceConnected
    ) {
      return;
    }

    try {
      if (this.audioSource) {
        this.audioSource.disconnect();
      }

      this.audioSource = this.audioContext.createMediaElementSource(
        this.audioElement
      );
      this.audioSource.connect(this.mediaStreamDestination);
      this.audioSource.connect(this.audioContext.destination);
      this.isAudioSourceConnected = true;
    } catch (error) {
      console.error("Error in setupAudioSource:", error);
    }
  }

  async changeMusic(file: File): Promise<void> {
    this.stopMusic();
    this.isAudioSourceConnected = false;

    try {
      const audioKey = `user-music-${Date.now()}`;
      const audioUrl = URL.createObjectURL(
        new Blob([await file.arrayBuffer()])
      );

      const audioBuffer = await this.audioContext!.decodeAudioData(
        await file.arrayBuffer()
      );
      this.scene.cache.audio.add(audioKey, audioBuffer);

      this.bgMusic = this.scene.sound.add(audioKey, {
        loop: true,
        volume: 0.5,
      });

      this.audioElement = new Audio(audioUrl);
      this.audioElement.loop = true;

      // Set up new audio source connection
      this.setupAudioSource();

      this.bgMusic.play();
      this.audioElement.play();
    } catch (error) {
      console.error("Error changing music:", error);
      throw error;
    }
  }

  getAudioStream(): MediaStream | undefined {
    if (
      !this.audioElement ||
      !this.audioContext ||
      !this.mediaStreamDestination
    ) {
      return undefined;
    }

    try {
      if (!this.isAudioSourceConnected) {
        this.setupAudioSource();
      }

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      return this.mediaStreamDestination.stream;
    } catch (error) {
      console.error("Error in getAudioStream:", error);
      return undefined;
    }
  }

  stopMusic(): void {
    if (this.bgMusic?.isPlaying) this.bgMusic.stop();
    if (this.audioElement) this.audioElement.pause();
    this.isMusicPlaying = false;
  }

  destroy(): void {
    this.stopMusic();
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = undefined;
    }
    this.isAudioSourceConnected = false;
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.audioElement) {
      this.audioElement.src = "";
    }
  }
}
