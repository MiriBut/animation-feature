export class ResolutionAdapter {
  // Default base resolution (16:9)
  private readonly BASE_WIDTH: number = 1920;
  private readonly BASE_HEIGHT: number = 1080;

  // Initial resolution
  private initialWidth: number;
  private initialHeight: number;

  // Current resolution
  private currentWidth: number;
  private currentHeight: number;

  constructor(
    initialWidth?: number,
    initialHeight?: number,
    currentWidth?: number,
    currentHeight?: number
  ) {
    // Use provided initial resolution or default to base resolution
    this.initialWidth = initialWidth || this.BASE_WIDTH;
    this.initialHeight = initialHeight || this.BASE_HEIGHT;

    // Use provided current resolution or default to initial resolution
    this.currentWidth = currentWidth || this.initialWidth;
    this.currentHeight = currentHeight || this.initialHeight;

    console.log(
      `ResolutionAdapter initialized: Initial: ${this.initialWidth}x${this.initialHeight}, Current: ${this.currentWidth}x${this.currentHeight}`
    );
  }

  /**
   * Update the current resolution
   */
  public updateCurrentResolution(width: number, height: number): void {
    this.currentWidth = width;
    this.currentHeight = height;
    console.log(`Current resolution updated to: ${width}x${height}`);
  }

  /**
   * Adapt position from initial resolution to current resolution
   */
  public adaptPosition(x: number, y: number): { x: number; y: number } {
    // Calculate relative position (0-1) based on initial resolution
    const relativeX = x / this.initialWidth;
    const relativeY = y / this.initialHeight;

    // Convert relative position to current resolution
    return {
      x: relativeX * this.currentWidth,
      y: relativeY * this.currentHeight,
    };
  }

  /**
   * Adapt scale value from initial resolution to current resolution
   */
  public adaptScale(scale: number): number {
    // Calculate resolution ratio
    const widthRatio = this.currentWidth / this.initialWidth;
    const heightRatio = this.currentHeight / this.initialHeight;

    // Use smaller ratio to preserve aspect ratio
    const resolutionRatio = Math.min(widthRatio, heightRatio);

    // Apply ratio to scale
    return scale * resolutionRatio;
  }

  /**
   * Adapt a scale object with x and y prop
   * erties
   */
  public adaptScaleObject(scale: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const widthRatio = this.currentWidth / this.initialWidth;
    const heightRatio = this.currentHeight / this.initialHeight;

    // Preserve aspect ratio by using the same ratio for both dimensions
    const minRatio = Math.min(widthRatio, heightRatio);

    return {
      x: scale.x * minRatio,
      y: scale.y * minRatio,
    };
  }

  /**
   * Convert absolute pixel position to relative position (0-1)
   */
  public pixelToRelativePosition(
    x: number,
    y: number
  ): { x: number; y: number } {
    return {
      x: x / this.initialWidth,
      y: y / this.initialHeight,
    };
  }

  /**
   * Convert relative position (0-1) to absolute pixel position
   */
  public relativeToPixelPosition(
    relativeX: number,
    relativeY: number
  ): { x: number; y: number } {
    return {
      x: relativeX * this.currentWidth,
      y: relativeY * this.currentHeight,
    };
  }

  /**
   * Get the current resolution ratios
   */
  public getResolutionRatio(): {
    widthRatio: number;
    heightRatio: number;
    minRatio: number;
  } {
    const widthRatio = this.currentWidth / this.initialWidth;
    const heightRatio = this.currentHeight / this.initialHeight;
    const minRatio = Math.min(widthRatio, heightRatio);

    return { widthRatio, heightRatio, minRatio };
  }

  /**
   * Get the base resolution used for calculations
   */
  public getBaseResolution(): { width: number; height: number } {
    return { width: this.initialWidth, height: this.initialHeight };
  }

  /**
   * Get the current resolution
   */
  public getCurrentResolution(): { width: number; height: number } {
    return { width: this.currentWidth, height: this.currentHeight };
  }
}
