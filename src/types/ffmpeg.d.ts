declare module "@ffmpeg/ffmpeg" {
  export interface FFmpegLoadConfig {
    coreURL: string;
    wasmURL: string;
  }

  export class FFmpeg {
    load(config?: FFmpegLoadConfig): Promise<void>;
    writeFile(name: string, data: Uint8Array): Promise<void>;
    readFile(name: string): Promise<Uint8Array>;
    exec(args: string[]): Promise<number>;
  }
}

declare module "@ffmpeg/util" {
  export function fetchFile(file: File | Blob | string): Promise<Uint8Array>;
  export function toBlobURL(url: string, mimeType: string): Promise<string>;
}
