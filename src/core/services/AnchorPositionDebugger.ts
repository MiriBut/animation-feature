import Phaser from "phaser";

// Interface for position data
interface Position {
  x: number;
  y: number;
  z?: number;
}

// Interface for anchor data
interface Anchor {
  x: number;
  y: number;
}

export class AnchorPositionDebugger {
  private scene: Phaser.Scene;
  private currentWidth: number;
  private currentHeight: number;
  private widthRatio: number;
  private heightRatio: number;
  // Define 9 anchor points (corners, side centers, and screen center)
  private anchorPoints: Anchor[] = [
    { x: 0, y: 0 }, // Top-left
    { x: 1, y: 0 }, // Top-right
    { x: 0, y: 1 }, // Bottom-left
    { x: 1, y: 1 }, // Bottom-right
    { x: 0.5, y: 0 }, // Top-center
    { x: 0.5, y: 1 }, // Bottom-center
    { x: 0, y: 0.5 }, // Left-center
    { x: 1, y: 0.5 }, // Right-center
    { x: 0.5, y: 0.5 }, // Center
  ];
  private popup?: HTMLDivElement; // Store reference to popup
  private isPopupOpen: boolean = false; // Track popup state

  constructor(
    scene: Phaser.Scene,
    currentWidth: number,
    currentHeight: number,
    widthRatio: number,
    heightRatio: number
  ) {
    this.scene = scene;
    this.currentWidth = currentWidth;
    this.currentHeight = currentHeight;
    this.widthRatio = widthRatio;
    this.heightRatio = heightRatio;

    // Initialize input listeners
    this.setupInputListeners();
  }

  // Set up mouse and keyboard event listeners
  private setupInputListeners(): void {
    // Handle mouse clicks with Ctrl
    this.scene.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        const keyboard = this.scene.input.keyboard;
        const isCtrlPressed = keyboard?.checkDown(
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
        );
        const isAltPressed = keyboard?.checkDown(
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT)
        );
        if (pointer.leftButtonDown() && isCtrlPressed && !isAltPressed) {
          this.logPositionToConsole(pointer);
        }
      },
      this
    );

    // Handle Ctrl+Alt key press to toggle popup
    this.scene.input.keyboard?.on(
      "keydown",
      (event: KeyboardEvent) => {
        const isCtrlPressed = event.ctrlKey;
        const isAltPressed = event.altKey;
        if (isCtrlPressed && isAltPressed) {
          this.togglePopup();
        }
      },
      this
    );

    // Update popup with mouse movement
    this.scene.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        if (this.isPopupOpen && this.popup) {
          this.updatePopupContent(pointer);
        }
      },
      this
    );
  }

  // Calculate position data based on closest anchor
  private calculatePositionData(pointer: Phaser.Input.Pointer): {
    anchor: Anchor;
    position: Position;
  } {
    // Get pointer position in world coordinates
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    // Normalize pointer position to [0, 1] range
    const normalizedX = worldX / this.currentWidth;
    const normalizedY = worldY / this.currentHeight;

    // Find closest anchor point
    let closestAnchor: Anchor = this.anchorPoints[0];
    let minDistance = Number.MAX_VALUE;

    for (const anchor of this.anchorPoints) {
      const distance = Math.sqrt(
        (normalizedX - anchor.x) ** 2 + (normalizedY - anchor.y) ** 2
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestAnchor = anchor;
      }
    }

    // Calculate base position from closest anchor
    const baseX = closestAnchor.x * this.currentWidth;
    const baseY = closestAnchor.y * this.currentHeight;

    // Calculate offset from anchor, unscaled by resolution
    const offsetX = (worldX - baseX) / this.widthRatio;
    const offsetY = (worldY - baseY) / this.heightRatio;

    return {
      anchor: { x: closestAnchor.x, y: closestAnchor.y },
      position: { x: offsetX, y: offsetY },
    };
  }

  // Log position data to console
  private logPositionToConsole(pointer: Phaser.Input.Pointer): void {
    const { anchor, position } = this.calculatePositionData(pointer);
    console.log({
      anchor: {
        x: parseFloat(anchor.x.toFixed(1)),
        y: parseFloat(anchor.y.toFixed(1)),
      },
      position: {
        x: parseFloat(position.x.toFixed(1)),
        y: parseFloat(position.y.toFixed(1)),
      },
    });
  }

  // Toggle popup visibility
  private togglePopup(): void {
    if (this.isPopupOpen) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  // Open popup in top-right corner
  private openPopup(): void {
    // Create popup container
    this.popup = document.createElement("div");
    this.popup.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background-color: rgba(255, 255, 255, 0.9);
      padding: 12px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #333;
      min-width: 150px;
    `;

    // Initialize content with current pointer position
    const pointer = this.scene.input.activePointer;
    this.updatePopupContent(pointer);

    // Append to document
    document.body.appendChild(this.popup);
    this.isPopupOpen = true;
  }

  // Update popup content with pointer position
  private updatePopupContent(pointer: Phaser.Input.Pointer): void {
    if (!this.popup) return;

    const { anchor, position } = this.calculatePositionData(pointer);
    this.popup.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Anchor:</strong> (${anchor.x.toFixed(1)}, ${anchor.y.toFixed(
      1
    )})
      </div>
      <div>
        <strong>Position:</strong> (x: ${position.x.toFixed(
          1
        )}, y: ${position.y.toFixed(1)})
      </div>
    `;
  }

  // Close and remove popup
  private closePopup(): void {
    if (this.popup) {
      this.popup.remove();
      this.popup = undefined;
      this.isPopupOpen = false;
    }
  }

  // Update resolution ratios if needed
  public updateResolution(
    width: number,
    height: number,
    widthRatio: number,
    heightRatio: number
  ): void {
    this.currentWidth = width;
    this.currentHeight = height;
    this.widthRatio = widthRatio;
    this.heightRatio = heightRatio;
  }

  // Destroy event listeners and cleanup
  public destroy(): void {
    this.scene.input.off("pointerdown");
    this.scene.input.off("keydown");
    this.scene.input.off("pointermove");
    this.closePopup();
  }
}
