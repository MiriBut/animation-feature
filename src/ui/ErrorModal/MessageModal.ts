// MessageModal.ts
export type ModalType = "error" | "success";

export interface MessageModalProps {
  isOpen: boolean;
  type: ModalType;
  title?: string;
  messages: string[];
  autoClose?: boolean;
  autoCloseTime?: number;
}

export class MessageModal {
  private static instance: MessageModal | null = null;
  private modalElement: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private autoCloseTimeout: number | null = null;

  private constructor() {
    this.ensureStyles();
  }

  private ensureStyles(): void {
    if (document.getElementById("message-modal-styles")) return;

    this.styleElement = document.createElement("style");
    this.styleElement.id = "message-modal-styles";
    this.styleElement.textContent = `
      .message-modal-overlay {
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

      .message-modal {
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
        max-width: 500px;
        width: 90%;
        min-width: 300px;
        font-family: inherit;
      }

      .message-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 12px;
      }

      .error-header h3 {
        color: #d32f2f;
      }

      .success-header h3 {
        color: #2e7d32;
      }

      .message-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
      }

      .close-button {
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        padding: 0;
      }

      .message-body {
        max-height: 300px;
        overflow-y: auto;
      }

      .message-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .message-item {
        padding: 8px 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 14px;
      }

      .error-item {
        background-color: #ffebee;
        border-left: 4px solid #d32f2f;
        color: #d32f2f;
      }

      .success-item {
        background-color: #e8f5e9;
        border-left: 4px solid #2e7d32;
        color: #2e7d32;
      }

      .message-footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
      }

      .dismiss-button {
        padding: 8px 16px;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s ease;
        color: white;
      }

      .error-button {
        background-color: #d32f2f;
      }

      .error-button:hover {
        background-color: #b71c1c;
      }

      .success-button {
        background-color: #2e7d32;
      }

      .success-button:hover {
        background-color: #1b5e20;
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  private updateModalContent(props: MessageModalProps): void {
    if (!this.modalElement) return;

    const messagesList = props.messages
      .map(
        (message: string) =>
          `<li class="message-item ${props.type}-item">${message}</li>`
      )
      .join("");

    this.modalElement.innerHTML = `
      <div class="message-modal">
        <div class="message-content">
          <div class="message-header ${props.type}-header">
            <h3>${
              props.title || (props.type === "error" ? "Error" : "Success")
            }</h3>
            <button class="close-button">×</button>
          </div>
          <div class="message-body">
            <ul class="message-list">
              ${messagesList}
            </ul>
          </div>
          ${
            props.type === "error"
              ? `<div class="message-footer">
                <button class="dismiss-button ${props.type}-button">
                  Dismiss
                </button>
              </div>`
              : ""
          }
        </div>
      </div>
    `;

    // הוספת מאזיני לחיצה באמצעות JavaScript
    const closeButton = this.modalElement.querySelector(".close-button");
    const dismissButton = this.modalElement.querySelector(".dismiss-button");

    if (closeButton) {
      closeButton.addEventListener("click", () => this.close());
    }

    if (dismissButton) {
      dismissButton.addEventListener("click", () => this.close());
    }
  }

  public static getInstance(): MessageModal {
    if (!MessageModal.instance) {
      MessageModal.instance = new MessageModal();
    }
    return MessageModal.instance;
  }

  public show(props: MessageModalProps): void {
    if (this.modalElement) {
      this.close();
    }

    this.modalElement = document.createElement("div");
    this.modalElement.className = "message-modal-overlay";
    document.body.appendChild(this.modalElement);
    this.updateModalContent(props);

    if (props.autoClose) {
      this.autoCloseTimeout = window.setTimeout(() => {
        this.close();
      }, props.autoCloseTime || 3000);
    }
  }

  public close(): void {
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout);
      this.autoCloseTimeout = null;
    }

    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
  }
}

// פונקציית עזר גלובלית
export function showMessage(props: MessageModalProps): void {
  MessageModal.getInstance().show(props);
}
