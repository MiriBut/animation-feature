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
      const videoStream = this.scene.game.canvas.captureStream(30);
      const audioStream = await this.audioManager.getAudioStream();

      if (!audioStream || audioStream.getAudioTracks().length === 0) {
        throw new Error("No audio tracks available");
      }

      if (videoStream.getVideoTracks().length === 0) {
        throw new Error("No video tracks available");
      }

      const combinedTracks = [
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      this.mediaRecorder = new MediaRecorder(combinedStream, {
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
        this.saveRecordingFromChunks();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      this.isRecording = false;
      throw error;
    }
  }

  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.stop();
  }

  private async saveRecordingFromChunks(): Promise<void> {
    if (this.chunks.length === 0) {
      console.warn("No recording data available");
      return;
    }

    const webmBlob = new Blob(this.chunks, {
      type: this.mediaRecorder?.mimeType || "video/webm",
    });

    await this.saveRecording(webmBlob);
    this.chunks = [];
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
