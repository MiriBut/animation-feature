import { Scene } from "phaser";

export class PhaserAudioRecorder {
  private scene: Scene;
  private audioContext: AudioContext | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private bypassNodes: Map<string, GainNode> = new Map();
  private audioStream: MediaStream | null = null;
  private originalSoundManagerDestination: AudioNode | null = null;
  private ready: boolean = false;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public async initialize(): Promise<boolean> {
    try {
      // Get the audio context from the scene
      const soundManager = this.scene.sound;
      if (!soundManager || !("context" in soundManager)) {
        console.error("Sound manager not initialized or no Web Audio support");
        return false;
      }

      this.audioContext = soundManager.context as AudioContext;
      if (!this.audioContext) {
        console.error("Failed to get AudioContext from Phaser sound manager");
        return false;
      }

      // Resume the audio context if needed
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        console.log("AudioContext resumed");
      }

      // Create destination node for recording
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      console.log("Created MediaStreamAudioDestinationNode");

      // Setup bypass from Phaser sound system directly to recording
      await this.setupSoundManagerBypass();

      // Connect all existing sounds
      await this.connectAllSounds();

      // Set up monitoring for new sounds
      this.setupSoundMonitoring();
      this.setupSoundMonitoring();

      this.audioStream = this.destinationNode.stream;
      this.ready = true;

      return true;
    } catch (error) {
      console.error("Error initializing PhaserAudioRecorder:", error);
      return false;
    }
  }

  /**
   * Get the audio stream for use in recording
   */
  public getAudioStream(): MediaStream | null {
    if (!this.ready || !this.audioStream) {
      console.warn("Audio system not ready, stream not available");
      return null;
    }
    return this.audioStream;
  }

  /**
   * Setup a direct bypass from the main sound system to the recording stream
   */
  private async setupSoundManagerBypass(): Promise<void> {
    if (!this.audioContext || !this.destinationNode) return;

    try {
      const soundManager = this.scene.sound as any;

      const possibleDestinationProps = [
        "destination",
        "_destination",
        "masterDestination",
      ];
      const possibleVolumeProps = [
        "masterVolume",
        "_masterVolume",
        "masterVolumeNode",
        "_masterVolumeNode",
      ];

      for (const prop of possibleDestinationProps) {
        if (
          soundManager[prop] &&
          typeof soundManager[prop].connect === "function"
        ) {
          this.originalSoundManagerDestination = soundManager[prop];
          console.log(`Found sound manager destination at ${prop}`);
          break;
        }
      }

      let masterVolumeNode = null;
      for (const prop of possibleVolumeProps) {
        if (
          soundManager[prop] &&
          typeof soundManager[prop].connect === "function"
        ) {
          masterVolumeNode = soundManager[prop];
          console.log(`Found master volume at ${prop}`);
          break;
        }
      }

      if (masterVolumeNode) {
        try {
          masterVolumeNode.connect(this.destinationNode);
          console.log("Connected master volume node to recording destination");
        } catch (e) {
          console.error("Failed to connect master volume node:", e);
        }
      }

      const silentOscillator = this.audioContext.createOscillator();
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0.001;

      silentOscillator.connect(silentGain);
      silentGain.connect(this.destinationNode);
      silentOscillator.start();

      // Cleanup after one minute
      setTimeout(() => {
        silentOscillator.stop();
        silentOscillator.disconnect();
        silentGain.disconnect();
      }, 60000);

      console.log("Created silent oscillator to keep stream active");
    } catch (error) {
      console.error("Error setting up sound manager bypass:", error);
    }
  }

  /**
   * Connect all existing sounds to the recording system
   */
  private async connectAllSounds(): Promise<void> {
    if (!this.destinationNode) return;

    const soundManager = this.scene.sound;
    const sounds = Array.isArray((soundManager as any).sounds)
      ? (soundManager as any).sounds
      : [];

    console.log(`PhaserAudioRecorder: Found ${sounds.length} existing sounds`);

    for (const sound of sounds) {
      await this.connectSound(sound);
    }
  }

  /**
   * Set up monitoring for new sounds being added
   */
  private setupSoundMonitoring(): void {
    try {
      const eventEmitter = this.scene.sound as Phaser.Events.EventEmitter;

      if (eventEmitter && eventEmitter.on) {
        eventEmitter.on("add", (sound: any) => {
          console.log(`Sound added event detected: ${sound?.key || "unknown"}`);
          this.connectSound(sound);
        });

        console.log("Installed sound event listener");
      } else {
        console.log("Event emitter not available, using polling approach");

        const existingSounds = new Set<string>();
        const checkInterval = setInterval(() => {
          if (!this.scene || !this.scene.sound) {
            clearInterval(checkInterval);
            return;
          }

          const soundManager = this.scene.sound as any;
          const sounds = Array.isArray(soundManager.sounds)
            ? soundManager.sounds
            : [];

          sounds.forEach((sound: { key: string }) => {
            const key = sound.key || "unknown";
            if (!existingSounds.has(key)) {
              console.log(`Detected new sound: ${key}`);
              existingSounds.add(key);
              this.connectSound(sound);
            }
          });
        }, 500);
      }
    } catch (error) {
      console.error("Failed to set up sound monitoring:", error);
    }
  }

  private async connectSound(sound: any): Promise<void> {
    if (!this.audioContext || !this.destinationNode) return;

    try {
      const soundKey = sound.key || "unknown";
      console.log(`Connecting sound: ${soundKey}`);

      if (
        sound instanceof Phaser.Sound.WebAudioSound ||
        (sound.constructor && sound.constructor.name === "WebAudioSound")
      ) {
        const bypassNode = this.audioContext.createGain();
        bypassNode.gain.value = 1.0; // עוצמה מלאה
        this.bypassNodes.set(soundKey, bypassNode);

        bypassNode.connect(this.destinationNode);

        const possibleSourceNodes = [
          "source",
          "_source",
          "gain",
          "_gain",
          "_gainNode",
          "pannerNode",
          "_pannerNode",
          "_pan",
          "_muteNode",
          "_output",
        ];

        let connected = false;
        for (const nodeName of possibleSourceNodes) {
          if (
            sound[nodeName] &&
            typeof sound[nodeName].connect === "function"
          ) {
            try {
              sound[nodeName].connect(bypassNode);
              console.log(`Connected ${soundKey} via ${nodeName}`);
              connected = true;
            } catch (e) {
              console.log(`Failed to connect ${soundKey} via ${nodeName}:`, e);
            }
          }
        }

        if (!connected) {
          console.log(`Could not directly connect ${soundKey}, using events`);

          sound.once("play", () => {
            console.log(`Sound ${soundKey} play event detected`);
            setTimeout(() => this.onSoundPlay(sound), 10);
          });

          sound.once("stop", () => {
            console.log(`Sound ${soundKey} stop event detected`);
            sound.once("play", () => {
              console.log(`Sound ${soundKey} play event after stop`);
              setTimeout(() => this.onSoundPlay(sound), 10);
            });
          });
        }
      } else {
        console.log(`Sound ${soundKey} is not a WebAudioSound, skipping`);
      }
    } catch (error) {
      console.error(`Error connecting sound:`, error);
    }
  }

  private onSoundPlay(sound: any): void {
    if (!this.audioContext || !this.destinationNode) return;

    const soundKey = sound.key || "unknown";

    try {
      let bypassNode = this.bypassNodes.get(soundKey);
      if (!bypassNode) {
        bypassNode = this.audioContext.createGain();
        bypassNode.gain.value = 1.0;
        bypassNode.connect(this.destinationNode);
        this.bypassNodes.set(soundKey, bypassNode);
      }

      const possibleSourceNodes = [
        "source",
        "_source",
        "gain",
        "_gain",
        "_gainNode",
        "pannerNode",
      ];

      for (const nodeName of possibleSourceNodes) {
        if (sound[nodeName] && typeof sound[nodeName].connect === "function") {
          try {
            sound[nodeName].connect(bypassNode);
            console.log(`Connected active sound ${soundKey} via ${nodeName}`);
            return;
          } catch (e) {
            console.log(`Failed to connect active sound via ${nodeName}:`, e);
          }
        }
      }

      console.log(`Could not find audio nodes for active sound ${soundKey}`);
    } catch (error) {
      console.error(`Error handling sound play event:`, error);
    }
  }

  /**
   * Clean up and release resources
   */
  public destroy(): void {
    this.bypassNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    });
    this.bypassNodes.clear();

    if (this.destinationNode) {
      try {
        this.destinationNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    this.destinationNode = null;
    this.audioStream = null;
    this.ready = false;
    console.log("PhaserAudioRecorder resources released");
  }
}
