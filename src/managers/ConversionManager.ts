export interface ConversionProgress {
  progress: number;
  estimatedTimeLeft: number;
  currentStep: string;
}

export class ConversionManager {
  private ffmpegInstance: any = null;
  private fetchFile: any = null;
  private conversionStartTime: number = 0;
  private lastProgress: number = 0;
  private currentProgressCallback?: (progress: ConversionProgress) => void;

  constructor() {
    console.log("Initializing ConversionManager");
  }

  private updateProgress(progress: number, step: string) {
    const estimatedTimeLeft = this.calculateEstimatedTime(progress);
    this.currentProgressCallback?.({
      progress,
      estimatedTimeLeft,
      currentStep: step,
    });
  }

  private calculateEstimatedTime(progress: number): number {
    if (progress <= 0) return 0;

    const timeElapsed = (Date.now() - this.conversionStartTime) / 1000;
    if (timeElapsed <= 0) return 0;

    const timePerPercent = timeElapsed / progress;
    const remainingProgress = 100 - progress;

    return Math.max(0, timePerPercent * remainingProgress);
  }

  private async loadFFmpeg(): Promise<void> {
    if (!this.ffmpegInstance) {
      this.updateProgress(0, "Loading converter");

      try {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg");
        const { fetchFile } = await import("@ffmpeg/util");

        const ffmpeg = new FFmpeg();
        await ffmpeg.load({
          coreURL: "/ffmpeg-core.js",
          wasmURL: "/ffmpeg-core.wasm",
        });

        this.ffmpegInstance = ffmpeg;
        this.fetchFile = fetchFile;
        console.log("FFmpeg loaded successfully");
      } catch (error) {
        console.error("Error loading FFmpeg:", error);
        throw new Error(
          `Failed to load FFmpeg: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  async convertWebMToMP4(
    webmBlob: Blob,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<Blob> {
    this.conversionStartTime = Date.now();
    this.lastProgress = 0;
    this.currentProgressCallback = onProgress;

    console.log("Starting WebM to MP4 conversion");

    try {
      await this.loadFFmpeg();

      if (!this.ffmpegInstance || !this.fetchFile) {
        throw new Error("FFmpeg failed to initialize");
      }

      const ffmpeg = this.ffmpegInstance;

      // Set up progress tracking
      let lastValidProgress = 5; // Start from where we left off after preparing
      ffmpeg.on(
        "progress",
        ({ ratio, time }: { ratio: number; time: number }) => {
          let percent: number;
          if (isNaN(ratio) || ratio < 0) {
            // If ratio is invalid, try to estimate progress
            percent = Math.min(lastValidProgress + 5, 90); // Increment by 5%, max 90%
          } else {
            percent = Math.round(ratio * 100);
          }

          if (percent > lastValidProgress) {
            lastValidProgress = percent;
            this.updateProgress(percent, "Processing");
          }
        }
      );

      // Write input file
      this.updateProgress(5, "Preparing video");
      console.log("Writing input file...");
      await ffmpeg.writeFile("input.webm", await this.fetchFile(webmBlob));

      // Start conversion
      console.log("Starting FFmpeg conversion...");
      await ffmpeg.exec([
        "-i",
        "input.webm",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "output.mp4",
      ]);

      // Read converted file
      this.updateProgress(95, "Finalizing");
      console.log("Reading output file...");
      const outputData = await ffmpeg.readFile("output.mp4");
      const outputBlob = new Blob([outputData], { type: "video/mp4" });

      this.updateProgress(100, "Complete");

      console.log("Conversion complete! MP4 blob size:", outputBlob.size);
      return outputBlob;
    } catch (error) {
      console.error("Error during conversion:", error);
      throw new Error(
        `Conversion failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      this.currentProgressCallback = undefined;
    }
  }
}
