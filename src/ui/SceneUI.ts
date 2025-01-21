import {
  MAX_AUDIO_FILE_SIZE,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_RESOLUTIONS,
} from "../config/constants";

export class SceneUI {
  private container: HTMLDivElement;

  constructor(
    private onResolutionChange: (width: number, height: number) => void,
    private onBackgroundChange: (file: File) => void,
    private onMusicChange: (file: File) => void,
    private onCharacterChange: (
      skelFile: File,
      atlasFile: File,
      pngFiles: File[]
    ) => void,
    private onRecordingStart: () => Promise<void>,
    private onRecordingStop: () => Promise<void>
  ) {
    console.log("scene ui starts");
    this.container = this.createContainer();
    this.createControls();
  }

  private createContainer(): HTMLDivElement {
    const containerDiv = document.createElement("div");
    containerDiv.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background-color: rgba(255, 255, 255, 0.9);
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      min-width: 200px;
    `;

    document.body.appendChild(containerDiv);
    return containerDiv;
  }

  private applySelectStyles(select: HTMLSelectElement): void {
    select.style.cssText = `
      width: 100%;
      padding: 12px;
      background-color: white;
      border: 1px solid #e0e0e0;
      border-radius: 25px;
      font-size: 14px;
      color: #333;
      cursor: pointer;
      outline: none;
      transition: all 0.3s ease;
    `;
  }

  private applyButtonStyles(
    button: HTMLButtonElement,
    color: string = "#4CAF50"
  ): void {
    button.style.cssText = `
      padding: 12px 24px;
      background-color: ${color};
      color: white;
      border: none;
      border-radius: 25px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      outline: none;
    `;

    button.onmouseenter = () => {
      button.style.transform = "translateY(-2px)";
      button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
      button.style.backgroundColor = this.adjustColor(color, -20);
    };

    button.onmouseleave = () => {
      button.style.transform = "translateY(0)";
      button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
      button.style.backgroundColor = color;
    };
  }

  private createControls(): void {
    const resolutionSelect = document.createElement("select");
    this.applySelectStyles(resolutionSelect);

    SUPPORTED_RESOLUTIONS.forEach((res) => {
      const option = document.createElement("option");
      option.value = `${res.width},${res.height}`;
      option.text = res.label;
      resolutionSelect.appendChild(option);
    });

    resolutionSelect.onchange = (e) => {
      const target = e.target as HTMLSelectElement;
      const [width, height] = target.value.split(",").map(Number);
      this.onResolutionChange(width, height);
    };

    const bgButton = document.createElement("button");
    bgButton.textContent = "Change Background";
    this.applyButtonStyles(bgButton, "#2196F3");
    bgButton.onclick = () => this.handleBackgroundSelect();

    const musicButton = document.createElement("button");
    musicButton.textContent = "Change Music";
    this.applyButtonStyles(musicButton, "#9C27B0");
    musicButton.onclick = () => this.handleMusicSelect();

    const characterButton = document.createElement("button");
    characterButton.textContent = "Change Character";
    this.applyButtonStyles(characterButton, "#673AB7");
    characterButton.onclick = () => this.handleCharacterSelect();

    const exportButton = document.createElement("button");
    exportButton.textContent = "Start Recording";
    this.applyButtonStyles(exportButton, "#4CAF50");

    exportButton.onclick = async () => {
      try {
        if (exportButton.textContent === "Start Recording") {
          await this.onRecordingStart();
          exportButton.textContent = "Stop Recording";
          this.applyButtonStyles(exportButton, "#f44336");
        } else {
          await this.onRecordingStop();
          exportButton.textContent = "Start Recording";
          this.applyButtonStyles(exportButton, "#4CAF50");
        }
      } catch (error) {
        console.error("Recording error:", error);
        exportButton.textContent = "Error";
        setTimeout(() => {
          exportButton.textContent = "Start Recording";
          this.applyButtonStyles(exportButton, "#4CAF50");
          exportButton.disabled = false;
        }, 2000);
      }
    };

    this.container.appendChild(resolutionSelect);
    this.container.appendChild(bgButton);
    this.container.appendChild(musicButton);
    this.container.appendChild(characterButton);
    this.container.appendChild(exportButton);
  }

  private handleBackgroundSelect(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.onBackgroundChange(target.files[0]);
      }
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
  }

  private handleMusicSelect(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.style.display = "none";

    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        if (file.size > MAX_AUDIO_FILE_SIZE) {
          alert("Audio file is too large. Maximum size is 20MB.");
          return;
        }
        if (!SUPPORTED_AUDIO_FORMATS.includes(file.type as any)) {
          alert("Unsupported audio format. Please use MP3, WAV, or OGG.");
          return;
        }
        this.onMusicChange(file);
      }
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
  }

  private handleCharacterSelect(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".skel,.json,.atlas,.png";
    input.multiple = true;
    input.style.display = "none";

    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files) {
        const files = Array.from(target.files);
        const skelFile = files.find(
          (f) => f.name.endsWith(".skel") || f.name.endsWith(".json")
        );
        const atlasFile = files.find((f) => f.name.endsWith(".atlas"));
        const pngFiles = files.filter((f) => f.name.endsWith(".png"));

        if (!skelFile || !atlasFile || pngFiles.length === 0) {
          alert(
            "Please select skeleton (.skel/.json), atlas (.atlas), and texture (.png) files"
          );
          return;
        }

        this.onCharacterChange(skelFile, atlasFile, pngFiles);
      }
    };

    document.body.appendChild(input);
    input.click();
    input.remove();
  }

  private adjustColor(color: string, amount: number): string {
    return (
      "#" +
      color
        .replace(/^#/, "")
        .replace(/../g, (color) =>
          (
            "0" +
            Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(
              16
            )
          ).substr(-2)
        )
    );
  }

  destroy(): void {
    this.container.remove();
  }
}
