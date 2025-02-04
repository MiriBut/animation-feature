import { Scene } from "phaser";
import { ConversionManager } from "./ConversionManager";
import {
  LoadingModal,
  LoadingModalProps,
} from "../ui/LoadingModal/LoadingModal";
import { AudioManager } from "./AudioManager";

export class ExportManager {
  private scene: Scene;
  private audioManager: AudioManager;
  private mediaRecorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private isRecording: boolean = false;
  private conversionManager: ConversionManager;
  private loadingModal: LoadingModal | null = null;
  private initializationAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;

  constructor(scene: Scene, audioManager: AudioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.conversionManager = new ConversionManager();
  }

  private async ensureAudioInitialized(): Promise<boolean> {
    if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
      console.error("Max audio initialization attempts reached");
      return false;
    }

    try {
      this.initializationAttempts++;

      if (!this.audioManager.isAudioReady()) {
        console.log("Audio not ready, attempting initialization...");
        await this.audioManager.initialize();

        // Wait for a short period to ensure audio context is properly started
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return this.audioManager.isAudioReady();
    } catch (error) {
      console.error("Error initializing audio:", error);
      return false;
    }
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.log("Already recording, ignoring start request");
      return;
    }

    try {
      // Ensure audio is initialized before starting
      const isAudioReady = await this.ensureAudioInitialized();
      if (!isAudioReady) {
        throw new Error(
          "Failed to initialize audio system after multiple attempts"
        );
      }

      const canvas = this.scene.game.canvas;
      const videoStream = canvas.captureStream(30);

      // Get audio stream with retry logic
      const audioStream = await this.retryGetAudioStream();
      if (!audioStream) {
        throw new Error("Failed to initialize audio stream");
      }

      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks available - ensure audio is playing");
      }

      console.log("Audio tracks found:", audioTracks.length);
      console.log("Audio track settings:", audioTracks[0].getSettings());

      const combinedTracks = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioTracks,
      ]);

      const mimeType = this.getSupportedMimeType();
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error("MediaRecorder format not supported on this browser");
      }

      this.mediaRecorder = new MediaRecorder(combinedTracks, {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000,
        audioBitsPerSecond: 128000,
      });

      this.setupRecorderHandlers();
      this.mediaRecorder.start();
      this.isRecording = true;
      console.log("Recording started successfully");
    } catch (error) {
      console.error("Error starting recording:", error);
      this.isRecording = false;
      throw error;
    }
  }

  private async retryGetAudioStream(
    maxAttempts: number = 3
  ): Promise<MediaStream | undefined> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const stream = await this.audioManager.getAudioStream();
        if (stream) {
          return stream;
        }
        console.log(
          `Attempt ${attempt}: No audio stream available, retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Attempt ${attempt}: Error getting audio stream:`, error);
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }
    return undefined;
  }

  public async changeResolution(
    newWidth: number,
    newHeight: number
  ): Promise<void> {
    if (!this.scene) throw new Error("Scene is not initialized.");

    const originalWidth = this.scene.game.canvas.width;
    const originalHeight = this.scene.game.canvas.height;
    const aspectRatio = originalWidth / originalHeight;

    if (Math.abs(newWidth / newHeight - aspectRatio) > 0.01) {
      console.warn("New resolution doesn't match the original aspect ratio.");
    }

    const wasRecording = this.isRecording;
    if (this.isRecording) {
      this.mediaRecorder?.pause();
    }

    this.scene.scale.resize(newWidth, newHeight);

    const ctx = this.scene.game.canvas.getContext("2d");
    if (ctx) {
      ctx.scale(newWidth / originalWidth, newHeight / originalHeight);
    }

    if (wasRecording) {
      this.mediaRecorder?.resume();
    }
  }

  private setupRecorderHandlers(): void {
    if (!this.mediaRecorder) return;

    this.chunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      const webmBlob = new Blob(this.chunks, {
        type: this.mediaRecorder?.mimeType || "video/webm",
      });
      this.saveRecording(webmBlob);
      this.chunks = [];
    };

    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      this.isRecording = false;
      this.chunks = [];
    };
  }

  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    console.log("Stopping recording...");
    this.mediaRecorder.stop();
  }

  pauseRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    console.log("Pausing recording...");
    this.mediaRecorder.pause();
  }

  resumeRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    console.log("Resuming recording...");
    this.mediaRecorder.resume();
  }

  public async saveRecording(blob: Blob): Promise<void> {
    try {
      this.loadingModal = new LoadingModal({
        isOpen: true,
        progress: 0,
        estimatedTimeLeft: 0,
        currentStep: "Initializing...",
      });

      const mp4Blob = await this.conversionManager.convertWebMToMP4(
        blob,
        (progress: Partial<LoadingModalProps>) => {
          if (this.loadingModal) {
            this.loadingModal.update(progress);
          }
        }
      );

      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date();
      const formattedDate = date
        .toLocaleDateString("en-GB")
        .replace(/\//g, "-");
      const formattedTime = date.toLocaleTimeString("en-GB").replace(/:/g, "-");
      a.download = `recording-${formattedDate}_${formattedTime}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error in saveRecording:", error);
      throw error;
    } finally {
      if (this.loadingModal) {
        this.loadingModal.close();
        this.loadingModal = null;
      }
    }
  }

  private getSupportedMimeType(): string {
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
    ];

    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    throw new Error("No supported mime type found for MediaRecorder");
  }

  destroy(): void {
    if (this.isRecording && this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.chunks = [];
    this.isRecording = false;
    if (this.loadingModal) {
      this.loadingModal.close();
      this.loadingModal = null;
    }
    this.initializationAttempts = 0;
  }
}
