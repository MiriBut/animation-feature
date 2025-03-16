// הוסף את הקוד הזה בתחילת ExportManager.ts
import { PhaserAudioRecorder } from "./PhaserAudioRecorder";

import { Scene } from "phaser";
import { AudioManager } from "./AudioManager";
import { ConversionManager } from "./ConversionManager";
import {
  LoadingModal,
  LoadingModalProps,
} from "../ui/LoadingModal/LoadingModal";

// שנה את המחלקה ExportManager לפי הקוד הבא:

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

  // הוסף שדה חדש לרקורדר האודיו שלנו
  private audioRecorder: PhaserAudioRecorder;

  constructor(scene: Scene, audioManager: AudioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.conversionManager = new ConversionManager();
    // יצירת מופע של הרקורדר החדש
    this.audioRecorder = new PhaserAudioRecorder(scene);
  }

  async ensureAudioInitialized(): Promise<boolean> {
    if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
      console.error("Max audio initialization attempts reached");
      return false;
    }
    try {
      this.initializationAttempts++;

      // אתחול מערכת האודיו הרגילה
      await this.audioManager.ensureAudioContext();
      if (!this.audioManager.isAudioReady()) {
        console.log("Audio not ready, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await this.ensureAudioInitialized(); // נסה שוב
      }
      console.log("Audio initialized successfully");

      // אתחול מערכת הרקורדר החדשה
      const recorderInitialized = await this.audioRecorder.initialize();
      if (!recorderInitialized) {
        console.warn(
          "Advanced audio recorder initialization failed, falling back to standard method"
        );
      } else {
        console.log("Advanced audio recorder initialized successfully");
      }

      // בדיקת האודיו סטרים (גם מהמערכת הרגילה וגם מהרקורדר המתקדם)
      const audioStream = await this.getOptimalAudioStream();
      if (!audioStream || audioStream.getAudioTracks().length === 0) {
        throw new Error("No audio tracks available in any audio system");
      }

      return true;
    } catch (error) {
      console.error("Error initializing audio:", error);
      return false;
    }
  }

  // מתודה חדשה לבחירת סטרים האודיו הטוב ביותר
  private async getOptimalAudioStream(): Promise<MediaStream | undefined> {
    // קודם נסה להשיג סטרים מהרקורדר המתקדם
    const advancedStream = this.audioRecorder.getAudioStream();
    if (advancedStream && advancedStream.getAudioTracks().length > 0) {
      console.log("Using advanced audio recorder stream");
      return advancedStream;
    }

    // אם לא הצליח, נפנה למערכת הרגילה
    console.log("Falling back to standard audio manager");
    return await this.audioManager.getAudioStream();
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.log("Already recording, ignoring start request");
      return;
    }

    try {
      // אתחול מערכות האודיו לפני תחילת ההקלטה
      const isAudioReady = await this.ensureAudioInitialized();
      if (!isAudioReady) {
        throw new Error(
          "Failed to initialize audio system after multiple attempts"
        );
      }

      const canvas = this.scene.game.canvas;
      const videoStream = canvas.captureStream(30);

      // השג סטרים אודיו עם מנגנון ניסיון חוזר
      const audioStream = await this.retryGetAudioStream();
      if (!audioStream) {
        throw new Error("Failed to initialize audio stream");
      }

      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks available - ensure audio is playing");
      }
      audioTracks.forEach((track) => {
        if (track.enabled === false || track.muted) {
          console.warn("Audio track is muted or disabled:", track);
          // נסה להפעיל את הטרק
          track.enabled = true;
        }
      });

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
        // נסה להשיג סטרים אודיו מהמערכת האופטימלית
        const stream = await this.getOptimalAudioStream();
        if (!stream || stream.getAudioTracks().length === 0) {
          console.log(`Attempt ${attempt}: No audio tracks, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        console.log(
          "Audio stream obtained successfully:",
          stream.getAudioTracks()
        );
        return stream;
      } catch (error) {
        console.error(`Attempt ${attempt}: Error getting audio stream:`, error);
        if (attempt === maxAttempts) throw error;
      }
    }
    throw new Error("Failed to get valid audio stream after all attempts");
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
    const preferredType = "video/webm;codecs=vp8,opus";
    if (MediaRecorder.isTypeSupported(preferredType)) {
      return preferredType;
    }
    // המשך ללוגיקה המקורית
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
    ];
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) return type;
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

    // נקה גם את הרקורדר החדש
    this.audioRecorder.destroy();

    this.initializationAttempts = 0;
  }
}
