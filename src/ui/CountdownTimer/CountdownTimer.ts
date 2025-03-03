export class CountdownTimer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private countText: Phaser.GameObjects.Text | undefined;
  private overlay: Phaser.GameObjects.Rectangle | undefined;
  private outerCircle: Phaser.GameObjects.Arc | undefined;
  private progressArc: Phaser.GameObjects.Arc | undefined;
  private count: number = 5;
  private timerEvent: Phaser.Time.TimerEvent | undefined;

  // Single primary color
  private readonly PRIMARY_COLOR = 0x4caf50;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(100);

    this.createOverlay();
    this.createCircles();
    this.createText();
  }

  private createOverlay(): void {
    this.overlay = this.scene.add.rectangle(
      0,
      0,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.3
    );
    this.overlay.setOrigin(0, 0);
    this.container.add(this.overlay);
  }

  private createCircles(): void {
    const centerX = this.scene.cameras.main.centerX;
    const centerY = this.scene.cameras.main.centerY;
    const circleSize = 120;

    // Static outer circle
    this.outerCircle = this.scene.add.arc(
      centerX,
      centerY,
      circleSize + 5,
      0,
      360,
      false,
      this.PRIMARY_COLOR,
      0.2
    );

    // Progress arc
    this.progressArc = this.scene.add.arc(
      centerX,
      centerY,
      circleSize,
      -90,
      270,
      false,
      this.PRIMARY_COLOR
    );
    this.progressArc.setStrokeStyle(6, this.PRIMARY_COLOR, 1);

    this.container.add([this.outerCircle, this.progressArc]);
  }

  private createText(): void {
    const textStyle = {
      fontSize: "96px",
      fontFamily: "Arial",
      color: "#FFFFFF",
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

    // Subtle initial animation
    this.scene.tweens.add({
      targets: this.countText,
      scale: { from: 0.9, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: "Power2.easeOut",
    });
  }

  private async animateNumber(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Subtle text scale animation
      this.scene.tweens.add({
        targets: this.countText,
        scale: { from: 1.1, to: 1 },
        duration: 300,
        ease: "Power2.easeOut",
      });

      // Progress arc rotation
      this.scene.tweens.add({
        targets: this.progressArc,
        angle: { from: 0, to: -(360 / this.count) },
        duration: 1000,
        ease: "Power1.easeInOut",
        onComplete: () => resolve(),
      });
    });
  }

  start(): Promise<void> {
    console.log(`Starting countdown`);

    // Simple fade in animation
    this.scene.tweens.add({
      targets: [this.outerCircle, this.progressArc],
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: "Power2.easeOut",
    });

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
        targets: [this.countText, this.outerCircle, this.progressArc],
        alpha: 0,
        duration: 300,
        ease: "Power2.easeIn",
      });

      // Overlay fade
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: 300,
        ease: "Power2.easeIn",
        onComplete: () => resolve(),
      });
    });
  }

  destroy(): void {
    if (this.timerEvent) this.timerEvent.destroy();
    this.container.destroy();
  }
}
