/// <reference lib="dom" />

export interface LoadingModalProps {
  isOpen: boolean;
  progress: number;
  estimatedTimeLeft: number;
  currentStep: string;
}

export class LoadingModal {
  private modalElement: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  constructor(initialProps: LoadingModalProps) {
    this.createModal(initialProps);
  }

  private createModal(props: LoadingModalProps): void {
    this.modalElement = document.createElement("div");
    this.modalElement.className = "loading-modal-overlay";
    this.updateModalContent(props);
    document.body.appendChild(this.modalElement);
    this.addStyles();
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return "Calculating...";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  private updateModalContent(props: LoadingModalProps): void {
    if (!this.modalElement) return;

    const progress = Math.max(0, isNaN(props.progress) ? 0 : props.progress);

    this.modalElement.innerHTML = `
      <div class="loading-modal">
        <div class="loading-content">
          <h3>Video Processing</h3>
          <div class="step-indicator">${props.currentStep}</div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
          <div class="progress-details">
            <span>${Math.round(progress)}%</span>
            <span>Time remaining: ${this.formatTime(
              props.estimatedTimeLeft
            )}</span>
          </div>
        </div>
      </div>
    `;
  }

  private addStyles(): void {
    if (document.getElementById("loading-modal-styles")) return;

    this.styleElement = document.createElement("style");
    this.styleElement.id = "loading-modal-styles";
    this.styleElement.textContent = `
      .loading-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }

      .loading-modal {
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
        max-width: 400px;
        width: 90%;
        min-width: 200px;
      }

      .loading-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .loading-modal h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: #333;
      }

      .step-indicator {
        color: #666;
        font-size: 14px;
      }

      .progress-bar-container {
        width: 100%;
        height: 10px;
        background-color: #e0e0e0;
        border-radius: 25px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background-color: #4CAF50;
        transition: width 0.3s ease, background-color 0.3s ease;
        border-radius: 25px;
      }

      .progress-details {
        display: flex;
        justify-content: space-between;
        color: #666;
        font-size: 14px;
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  public update(props: Partial<LoadingModalProps>): void {
    if (!this.modalElement) return;

    const currentProps: LoadingModalProps = {
      isOpen: true,
      progress: 0,
      estimatedTimeLeft: 0,
      currentStep: "",
      ...props,
    };

    this.updateModalContent(currentProps);
  }

  public close(): void {
    if (this.modalElement) {
      document.body.removeChild(this.modalElement);
      this.modalElement = null;
    }

    if (this.styleElement && document.head.contains(this.styleElement)) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
    }
  }
}
