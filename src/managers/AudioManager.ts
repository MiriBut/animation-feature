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
  private hasUserInteraction: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupUserInteractionListener();
  }

  private setupUserInteractionListener(): void {
    const userInteractionEvents = ["click", "touchstart", "keydown"];

    const handleUserInteraction = () => {
      if (!this.hasUserInteraction) {
        this.hasUserInteraction = true;
        this.initializeAudioContext();
        userInteractionEvents.forEach((event) => {
          document.removeEventListener(event, handleUserInteraction);
        });
      }
    };

    userInteractionEvents.forEach((event) => {
      document.addEventListener(event, handleUserInteraction);
    });
  }

  private initializeAudioContext(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        this.mediaStreamDestination =
          this.audioContext.createMediaStreamDestination();
      }
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }
    } catch (error) {
      console.warn("AudioContext initialization failed:", error);
    }
  }

  preload(): void {
    this.scene.load.once("complete", () => {
      this.isLoaded = true;
      this.tryPlayingDefaultMusic();
    });

    // Add error handling for loading
    this.scene.load.on("loaderror", (file: any) => {
      console.warn(`Failed to load audio file: ${file.key}`);
      this.isLoaded = false;
    });

    this.scene.load.audio(DEFAULT_ASSETS.music.key, DEFAULT_ASSETS.music.path);
  }

  private tryPlayingDefaultMusic(): void {
    if (this.isLoaded && this.hasUserInteraction) {
      this.initializeAudioContext();
      this.create();
    }
  }

  create(): void {
    if (!this.isLoaded) {
      console.warn("Audio not loaded yet");
      return;
    }

    try {
      const soundManager: any = this.scene.sound;
      if (
        soundManager.sounds?.some(
          (sound: Phaser.Sound.BaseSound) => sound.isPlaying
        )
      ) {
        return;
      }

      if (!this.scene.cache.audio.exists(DEFAULT_ASSETS.music.key)) {
        console.warn(
          "Audio file not found in cache:",
          DEFAULT_ASSETS.music.key
        );
        return;
      }

      // Create audio elements only if we have user interaction
      if (this.hasUserInteraction) {
        this.bgMusic = this.scene.sound.add(DEFAULT_ASSETS.music.key, {
          loop: true,
          volume: 0.5,
        });

        this.audioElement = new Audio(DEFAULT_ASSETS.music.path);
        this.audioElement.load(); // Explicitly load the audio
        this.audioElement.loop = true;

        // Only play if the context is running
        if (this.audioContext?.state === "running") {
          this.bgMusic.play();
          this.audioElement.play().catch((error) => {
            console.warn("Failed to play audio:", error);
          });
        }
      }
    } catch (error) {
      console.warn("Error in create:", error);
    }
  }

  async changeMusic(file: File): Promise<void> {
    if (!this.hasUserInteraction) {
      console.warn("Cannot change music before user interaction");
      return;
    }

    this.stopMusic();

    try {
      const audioKey = `user-music-${Date.now()}`;
      const audioUrl = URL.createObjectURL(
        new Blob([await file.arrayBuffer()])
      );

      // Validate audio file before loading
      const validationBuffer = await this.audioContext!.decodeAudioData(
        await file.arrayBuffer()
      );
      if (!validationBuffer) {
        throw new Error("Invalid audio file");
      }

      this.scene.cache.audio.add(audioKey, validationBuffer);

      this.bgMusic = this.scene.sound.add(audioKey, {
        loop: true,
        volume: 0.5,
      });

      this.audioElement = new Audio(audioUrl);
      this.audioElement.load();
      this.audioElement.loop = true;

      if (this.audioSource) {
        this.audioSource.disconnect();
      }

      this.audioSource = this.audioContext!.createMediaElementSource(
        this.audioElement
      );
      this.audioSource.connect(this.mediaStreamDestination!);
      this.audioSource.connect(this.audioContext!.destination);

      if (this.audioContext?.state === "running") {
        await Promise.all([
          this.bgMusic.play(),
          this.audioElement.play(),
        ]).catch((error) => {
          console.warn("Failed to play new audio:", error);
        });
      }
    } catch (error) {
      console.error("Error changing music:", error);
      throw error;
    }
  }

  getAudioStream(): MediaStream | undefined {
    if (
      !this.audioElement ||
      !this.audioContext ||
      !this.mediaStreamDestination ||
      !this.hasUserInteraction
    ) {
      return undefined;
    }

    try {
      if (!this.audioSource) {
        this.audioSource = this.audioContext.createMediaElementSource(
          this.audioElement
        );
        this.audioSource.connect(this.mediaStreamDestination);
        this.audioSource.connect(this.audioContext.destination);
      }

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      return this.mediaStreamDestination.stream;
    } catch (error) {
      console.warn("Error in getAudioStream:", error);
      return undefined;
    }
  }

  stopMusic(): void {
    if (this.bgMusic?.isPlaying) this.bgMusic.stop();
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
  }

  destroy(): void {
    this.stopMusic();
    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
      } catch (error) {
        console.warn("Error disconnecting audio source:", error);
      }
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn("Error closing audio context:", error);
      }
    }
    if (this.audioElement) {
      this.audioElement.src = "";
    }
  }
}
