export class CountdownTimer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private countText: Phaser.GameObjects.Text | undefined;
  private overlay: Phaser.GameObjects.Rectangle | undefined;
  private progressBar: Phaser.GameObjects.Arc | undefined;
  private count: number = 5;
  private timerEvent: Phaser.Time.TimerEvent | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(100);

    this.createOverlay();
    this.createProgressBar();
    this.createText();
  }

  private createOverlay(): void {
    this.overlay = this.scene.add.rectangle(
      0,
      0,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.5
    );
    this.overlay.setOrigin(0, 0);
    this.container.add(this.overlay);
  }

  private createProgressBar(): void {
    const centerX = this.scene.cameras.main.centerX;
    const centerY = this.scene.cameras.main.centerY;

    // Create progress bar as an arc (circle)
    this.progressBar = this.scene.add.arc(
      centerX,
      centerY,
      60,
      0,
      360,
      false,
      0x333333
    );
    this.progressBar.setStrokeStyle(3, 0xffffff);
    this.container.add(this.progressBar);
  }

  private createText(): void {
    const textStyle = {
      fontSize: "64px",
      fontFamily: "Arial",
      color: "#ffffff",
      fontWeight: "bold",
    };

    this.countText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      this.count.toString(),
      textStyle
    );

    this.countText.setOrigin(0.5);
    this.container.add(this.countText);
  }

  private async animateNumber(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Simple scale animation
      this.scene.tweens.add({
        targets: this.countText,
        scale: { from: 1.2, to: 1 },
        duration: 300,
        ease: "Power2",
      });

      // Progress bar animation
      this.scene.tweens.add({
        targets: this.progressBar,
        angle: { from: 0, to: -360 / this.count },
        duration: 1000,
        onComplete: () => resolve(),
      });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.timerEvent = this.scene.time.addEvent({
        delay: 1000,
        callback: async () => {
          this.count--;
          if (this.count > 0) {
            this.countText?.setText(this.count.toString());
            await this.animateNumber();
          } else {
            await this.playFinalAnimation();
            this.destroy();
            resolve();
          }
        },
        repeat: 5,
      });
    });
  }

  private async playFinalAnimation(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Simple fade out
      this.scene.tweens.add({
        targets: [this.countText, this.progressBar, this.overlay],
        alpha: 0,
        duration: 400,
        ease: "Power2",
        onComplete: () => resolve(),
      });
    });
  }

  destroy(): void {
    if (this.timerEvent) this.timerEvent.destroy();
    this.container.destroy();
  }
}
