import { Scene } from "phaser";
import { DEFAULT_ASSETS } from "../config/constants";

export class AudioManager {
  private scene: Scene;
  private bgMusic?: Phaser.Sound.BaseSound;
  private audioContext: AudioContext;
  private mediaStreamDestination: MediaStreamAudioDestinationNode;
  private audioElement?: HTMLAudioElement;
  private isLoaded: boolean = false;
  private audioSource?: MediaElementAudioSourceNode;
  private isAudioSourceConnected: boolean = false;
  private initializationPromise?: Promise<void>;

  constructor(scene: Scene) {
    this.scene = scene;
    this.audioContext = new AudioContext();
    this.mediaStreamDestination =
      this.audioContext.createMediaStreamDestination();
  }

  public isAudioReady(): boolean {
    return (
      this.isLoaded &&
      !!this.audioElement &&
      this.isAudioSourceConnected &&
      this.audioContext.state === "running"
    );
  }

  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      await this.preload();
      await this.create();
      await this.ensureAudioContext();

      if (!this.isAudioSourceConnected) {
        await this.setupAudioSource();
      }
    } catch (error) {
      console.error("Error during audio initialization:", error);
      throw error;
    }
  }

  async preload(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isLoaded) {
        resolve();
        return;
      }

      this.scene.load.once("complete", () => {
        this.isLoaded = true;
        resolve();
      });

      this.scene.load.once("loaderror", (file: any) => {
        reject(new Error(`Failed to load audio file: ${file.key}`));
      });

      this.scene.load.audio(
        DEFAULT_ASSETS.music.key,
        DEFAULT_ASSETS.music.path
      );
      this.scene.load.start();
    });
  }

  async create(): Promise<void> {
    if (!this.isLoaded) {
      throw new Error("Audio not loaded yet");
    }

    try {
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

      if (!this.scene.cache.audio.exists(DEFAULT_ASSETS.music.key)) {
        throw new Error(
          `Audio file not found in cache: ${DEFAULT_ASSETS.music.key}`
        );
      }

      this.bgMusic = this.scene.sound.add(DEFAULT_ASSETS.music.key, {
        loop: true,
        volume: 0.5,
      });

      this.audioElement = new Audio(DEFAULT_ASSETS.music.path);
      this.audioElement.loop = true;

      await this.setupAudioSource();

      await Promise.all([
        this.bgMusic.play(),
        this.audioElement.play().catch((e) => {
          console.warn("Auto-play prevented:", e);
        }),
      ]);
    } catch (error) {
      console.error("Error in create:", error);
      throw error;
    }
  }

  private async ensureAudioContext(): Promise<void> {
    try {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        console.log("AudioContext resumed successfully");
      }
    } catch (error) {
      console.error("Failed to resume AudioContext:", error);
      throw error;
    }
  }

  private async setupAudioSource(): Promise<void> {
    if (!this.audioElement) {
      throw new Error("Audio element not initialized");
    }

    if (this.isAudioSourceConnected) {
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
      console.log("Audio source setup completed successfully");
    } catch (error) {
      console.error("Error in setupAudioSource:", error);
      this.isAudioSourceConnected = false;
      throw error;
    }
  }

  async changeMusic(file: File): Promise<void> {
    this.stopMusic();
    this.isAudioSourceConnected = false;

    try {
      await this.ensureAudioContext();

      const audioKey = `user-music-${Date.now()}`;
      const audioUrl = URL.createObjectURL(
        new Blob([await file.arrayBuffer()])
      );

      const audioBuffer = await this.audioContext.decodeAudioData(
        await file.arrayBuffer()
      );

      this.scene.cache.audio.add(audioKey, audioBuffer);

      this.bgMusic = this.scene.sound.add(audioKey, {
        loop: true,
        volume: 0.5,
      });

      this.audioElement = new Audio(audioUrl);
      this.audioElement.loop = true;

      await this.setupAudioSource();

      await Promise.all([this.bgMusic.play(), this.audioElement.play()]);
    } catch (error) {
      console.error("Error changing music:", error);
      throw error;
    }
  }

  async getAudioStream(): Promise<MediaStream | undefined> {
    try {
      await this.ensureAudioContext();

      if (!this.audioElement) {
        console.warn("No audio element available");
        return undefined;
      }

      if (!this.isAudioSourceConnected) {
        await this.setupAudioSource();
      }

      const stream = this.mediaStreamDestination.stream;
      if (!stream || stream.getAudioTracks().length === 0) {
        console.warn("No audio tracks in stream");
        return undefined;
      }

      return stream;
    } catch (error) {
      console.error("Error in getAudioStream:", error);
      throw error;
    }
  }

  stopMusic(): void {
    if (this.bgMusic?.isPlaying) {
      this.bgMusic.stop();
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
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
      this.audioElement = undefined;
    }
    this.isLoaded = false;
    this.initializationPromise = undefined;
  }
}
