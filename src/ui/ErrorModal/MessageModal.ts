// MessageModal.ts
export type MessageType = "error" | "success" | "info";

export interface Message {
  type: MessageType;
  content: string;
}

export interface MessageModalProps {
  isOpen: boolean;
  title?: string;
  messages: (string | Message)[];
  autoClose?: boolean;
  autoCloseTime?: number;
}

export function createErrorMessage(content: string): Message {
  return { type: "error", content };
}

export function createInfoMessage(content: string): Message {
  return { type: "info", content };
}

export function createSuccessMessage(content: string): Message {
  return { type: "success", content };
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
        background-color: rgba(0, 0, 0, 0.75);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }

      .message-modal {
        background-color: #ffffff;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
        padding: 0;
        max-width: 600px;
        width: 95%;
        min-width: 320px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .message-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }

      .message-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
        background-color: #f8f9fa;
      }

      .message-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .close-button {
        background: none;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #666;
        font-size: 24px;
        transition: all 0.2s ease;
      }

      .close-button:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }

      .message-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }

      .message-section {
        margin-bottom: 24px;
      }

      .message-section:last-child {
        margin-bottom: 0;
      }

      .section-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 12px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid;
      }

      .error-section .section-title {
        color: #dc2626;
        border-color: #dc2626;
      }

      .success-section .section-title {
        color: #16a34a;
        border-color: #16a34a;
      }

      .info-section .section-title {
        color: #2563eb;
        border-color: #2563eb;
      }

      .message-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .message-item {
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.5;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .message-item::before {
        content: '';
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        background-position: center;
        background-repeat: no-repeat;
        background-size: contain;
      }

      .error-item {
        background-color: #fef2f2;
        color: #991b1b;
      }

      .error-item::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23dc2626'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E");
      }

      .success-item {
        background-color: #f0fdf4;
        color: #166534;
      }

      .success-item::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2316a34a'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/%3E%3C/svg%3E");
      }

      .info-item {
        background-color: #eff6ff;
        color: #1e40af;
      }

      .info-item::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'/%3E%3C/svg%3E");
      }

      .message-footer {
        padding: 16px 24px;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid #e0e0e0;
        background-color: #f8f9fa;
      }

      .modal-button {
        padding: 8px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .error-button {
        background-color: #dc2626;
        color: white;
      }

      .error-button:hover {
        background-color: #b91c1c;
      }

      .success-button {
        background-color: #16a34a;
        color: white;
      }

      .success-button:hover {
        background-color: #15803d;
      }

      .info-button {
        background-color: #2563eb;
        color: white;
      }

      .info-button:hover {
        background-color: #1d4ed8;
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  private categorizeMessages(
    messages: (string | Message)[]
  ): Record<MessageType, string[]> {
    const categorized: Record<MessageType, string[]> = {
      error: [],
      success: [],
      info: [],
    };

    messages.forEach((message) => {
      if (typeof message === "string") {
        // Default to info type for string messages
        categorized.info.push(message);
      } else {
        categorized[message.type].push(message.content);
      }
    });

    return categorized;
  }

  private createMessageSection(type: MessageType, messages: string[]): string {
    if (messages.length === 0) return "";

    const title = type.charAt(0).toUpperCase() + type.slice(1);
    const messagesList = messages
      .map((message) => `<li class="message-item ${type}-item">${message}</li>`)
      .join("");

    return `
      <div class="message-section ${type}-section">
        <h4 class="section-title">${title} Messages</h4>
        <ul class="message-list">
          ${messagesList}
        </ul>
      </div>
    `;
  }

  private updateModalContent(props: MessageModalProps): void {
    if (!this.modalElement) return;

    const categorizedMessages = this.categorizeMessages(props.messages);
    const messagesSections = Object.entries(categorizedMessages)
      .map(([type, messages]) =>
        this.createMessageSection(type as MessageType, messages)
      )
      .filter((section) => section !== "")
      .join("");

    const hasErrors = categorizedMessages.error.length > 0;

    this.modalElement.innerHTML = `
      <div class="message-modal">
        <div class="message-content">
          <div class="message-header">
            <h3>${props.title || "Message"}</h3>
            <button class="close-button" aria-label="Close">×</button>
          </div>
          <div class="message-body">
            ${messagesSections}
          </div>
          ${
            hasErrors
              ? `
            <div class="message-footer">
              <button class="modal-button error-button">Dismiss</button>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    // Add event listeners
    const closeButton = this.modalElement.querySelector(".close-button");
    const dismissButton = this.modalElement.querySelector(".error-button");

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

    if (
      props.autoClose &&
      !props.messages.some(
        (msg) => typeof msg === "object" && msg.type === "error"
      )
    ) {
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

// Helper functions
export function formatSuccessMessage(totalAssets: number): Message {
  return {
    type: "success",
    content: `${totalAssets} ${
      totalAssets === 1 ? "file loaded" : "files loaded"
    } successfully`,
  };
}

export function formatErrorMessage(fileName: string, reason?: string): Message {
  const baseMessage = `failed to load the file: ${fileName}`;
  return {
    type: "error",
    content: reason ? `${baseMessage} (${reason})` : baseMessage,
  };
}

export function formatInfoMessage(content: string): Message {
  return {
    type: "info",
    content,
  };
}

export function showMessage(props: MessageModalProps): void {
  MessageModal.getInstance().show(props);
}


