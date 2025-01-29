/// <reference lib="dom" />

export interface ErrorModalProps {
  isOpen: boolean;
  errors: string[];
  title?: string;
}

export class ErrorModal {
  private modalElement: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  constructor(initialProps: ErrorModalProps) {
    this.createModal(initialProps);
  }

  private createModal(props: ErrorModalProps): void {
    this.modalElement = document.createElement("div");
    this.modalElement.className = "error-modal-overlay";
    this.updateModalContent(props);
    document.body.appendChild(this.modalElement);
    this.addStyles();
  }

  private updateModalContent(props: ErrorModalProps): void {
    if (!this.modalElement) return;

    const errorsList = props.errors
      .map((error) => `<li class="error-item">${error}</li>`)
      .join("");

    this.modalElement.innerHTML = `
      <div class="error-modal">
        <div class="error-content">
          <div class="error-header">
            <h3>${props.title || "Loading Error"}</h3>
            <button class="close-button" onclick="this.closest('.error-modal-overlay').remove()">×</button>
          </div>
          <div class="error-body">
            <ul class="error-list">
              ${errorsList}
            </ul>
          </div>
          <div class="error-footer">
            <button class="dismiss-button" onclick="this.closest('.error-modal-overlay').remove()">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private addStyles(): void {
    if (document.getElementById("error-modal-styles")) return;

    this.styleElement = document.createElement("style");
    this.styleElement.id = "error-modal-styles";
    this.styleElement.textContent = `
      .error-modal-overlay {
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

      .error-modal {
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
        max-width: 500px;
        width: 90%;
        min-width: 300px;
        font-family: inherit;
      }

      .error-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .error-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 12px;
      }

      .error-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: #d32f2f;
      }

      .close-button {
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        padding: 0;
      }

      .error-body {
        max-height: 300px;
        overflow-y: auto;
      }

      .error-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .error-item {
        padding: 8px 12px;
        margin-bottom: 8px;
        background-color: #ffebee;
        border-left: 4px solid #d32f2f;
        border-radius: 4px;
        color: #d32f2f;
        font-size: 14px;
      }

      .error-footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
      }

      .dismiss-button {
        padding: 8px 16px;
        background-color: #d32f2f;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s ease;
      }

      .dismiss-button:hover {
        background-color: #b71c1c;
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  public update(props: Partial<ErrorModalProps>): void {
    if (!this.modalElement) return;

    const currentProps: ErrorModalProps = {
      isOpen: true,
      errors: [],
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
