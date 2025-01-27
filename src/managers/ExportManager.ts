import { Scene } from "phaser";
import { ConversionManager } from "./ConversionManager";
import {
  LoadingModal,
  LoadingModalProps,
} from "../ui/LoadingModal/LoadingModal";

export class ExportManager {
  private scene: Scene;
  private audioManager: any;
  private mediaRecorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private isRecording: boolean = false;
  private conversionManager: ConversionManager;
  private loadingModal: LoadingModal | null = null;

  constructor(scene: Scene, audioManager: any) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.conversionManager = new ConversionManager();
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      const canvas = this.scene.game.canvas;
      const videoStream = canvas.captureStream(30);

      // Directly use the game canvas stream instead of creating a new canvas
      const audioStream = await this.audioManager.getAudioStream();

      if (!audioStream || audioStream.getAudioTracks().length === 0) {
        throw new Error("No audio tracks available");
      }

      const combinedTracks = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      this.mediaRecorder = new MediaRecorder(combinedTracks, {
        mimeType: this.getSupportedMimeType(),
        videoBitsPerSecond: 8000000,
        audioBitsPerSecond: 128000,
      });

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

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      console.error("Error starting recording:", error);
      this.isRecording = false;
      throw error;
    }
  }

  public async changeResolution(
    newWidth: number,
    newHeight: number
  ): Promise<void> {
    if (!this.scene) throw new Error("Scene is not initialized.");

    // שמירה על יחס גובה-רוחב
    const originalWidth = this.scene.game.canvas.width;
    const originalHeight = this.scene.game.canvas.height;
    const aspectRatio = originalWidth / originalHeight;

    if (Math.abs(newWidth / newHeight - aspectRatio) > 0.01) {
      console.warn("New resolution doesn't match the original aspect ratio.");
    }

    // עצירת הקלטה זמנית
    const wasRecording = this.isRecording;
    if (this.isRecording) {
      // this.pouseRecording();
      this.mediaRecorder?.pause();
    }

    // שינוי הרזולוציה
    this.scene.scale.resize(newWidth, newHeight);

    // התאמת תוכן הקנבס לגודל החדש
    const ctx = this.scene.game.canvas.getContext("2d");
    if (ctx) {
      ctx.scale(newWidth / originalWidth, newHeight / originalHeight);
    }

    // התחלת הקלטה מחדש אם היא פעלה קודם
    if (wasRecording) {
      this.mediaRecorder?.resume();
      //await this.startRecording();
    }
  }

  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.stop();
  }

  pouseRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.pause();
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
  }
}
