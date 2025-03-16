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

  /**
   * אתחול המערכת וחיבור לכל הסאונדים
   */
  public async initialize(): Promise<boolean> {
    try {
      // השג את האודיו קונטקסט של הסצנה
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

      // חדש את האודיו קונטקסט אם צריך
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        console.log("AudioContext resumed");
      }

      // יצירת נוד היעד להקלטה
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      console.log("Created MediaStreamAudioDestinationNode");

      // יצירת ערוץ מעקף ממערכת הסאונד של פייזר ישירות אל ההקלטה
      await this.setupSoundManagerBypass();

      // חיבור ישיר של כל הסאונדים הקיימים
      await this.connectAllSounds();

      // הגדר האזנה לסאונדים חדשים
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
   * השג סטרים אודיו לשימוש ברקורדר
   */
  public getAudioStream(): MediaStream | null {
    if (!this.ready || !this.audioStream) {
      console.warn("Audio system not ready, stream not available");
      return null;
    }
    return this.audioStream;
  }

  /**
   * יצירת מעקף ישיר ממערכת הסאונד הראשית אל הסטרים המוקלט
   */
  private async setupSoundManagerBypass(): Promise<void> {
    if (!this.audioContext || !this.destinationNode) return;

    try {
      const soundManager = this.scene.sound as any;

      // גישה למאפיינים השונים של מנהל הסאונד
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

      // נסה למצוא את היעד המקורי של הסאונד
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

      // נסה למצוא את בקר העוצמה הראשי
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

      // אם מצאנו את בקר העוצמה, חבר אותו גם לנוד היעד שלנו
      if (masterVolumeNode) {
        try {
          masterVolumeNode.connect(this.destinationNode);
          console.log("Connected master volume node to recording destination");
        } catch (e) {
          console.error("Failed to connect master volume node:", e);
        }
      }

      // פתרון לסאונדים שלא יחוברו אוטומטית - יצירת אוסילטור בתדר שקט
      const silentOscillator = this.audioContext.createOscillator();
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0.001; // כמעט שקט, רק כדי לשמור את הזרימה פעילה

      silentOscillator.connect(silentGain);
      silentGain.connect(this.destinationNode);
      silentOscillator.start();

      // שמור לניקוי אחר כך
      setTimeout(() => {
        silentOscillator.stop();
        silentOscillator.disconnect();
        silentGain.disconnect();
      }, 60000); // כבה אחרי דקה - אמור להספיק להקלטה

      console.log("Created silent oscillator to keep stream active");
    } catch (error) {
      console.error("Error setting up sound manager bypass:", error);
    }
  }

  /**
   * חיבור כל הסאונדים הקיימים במערכת
   */
  private async connectAllSounds(): Promise<void> {
    if (!this.destinationNode) return;

    const soundManager = this.scene.sound;
    const sounds = Array.isArray((soundManager as any).sounds)
      ? (soundManager as any).sounds
      : [];

    console.log(`PhaserAudioRecorder: Found ${sounds.length} existing sounds`);

    // חבר כל סאונד באופן פרטני
    for (const sound of sounds) {
      await this.connectSound(sound);
    }
  }

  /**
   * התקנת מוניטור לסאונדים חדשים
   */
  private setupSoundMonitoring(): void {
    try {
      // שימוש בהאזנה לאירועים במקום החלפת פונקציה
      const eventEmitter = this.scene.sound as Phaser.Events.EventEmitter;

      // האזנה לאירוע יצירת סאונד
      if (eventEmitter && eventEmitter.on) {
        eventEmitter.on("add", (sound: any) => {
          console.log(`Sound added event detected: ${sound?.key || "unknown"}`);
          this.connectSound(sound);
        });

        console.log("Installed sound event listener");
      } else {
        // גישה אלטרנטיבית אם אין אירועים
        console.log("Event emitter not available, using polling approach");

        // בדוק כל חצי שניה אם יש סאונדים חדשים
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

  /**
   * חיבור סאונד בודד למערכת ההקלטה
   */
  private async connectSound(sound: any): Promise<void> {
    if (!this.audioContext || !this.destinationNode) return;

    try {
      const soundKey = sound.key || "unknown";
      console.log(`Connecting sound: ${soundKey}`);

      // בדיקה אם זה WebAudioSound
      if (
        sound instanceof Phaser.Sound.WebAudioSound ||
        (sound.constructor && sound.constructor.name === "WebAudioSound")
      ) {
        // יצירת נוד מעקף ייעודי לסאונד הזה
        const bypassNode = this.audioContext.createGain();
        bypassNode.gain.value = 1.0; // עוצמה מלאה
        this.bypassNodes.set(soundKey, bypassNode);

        // חיבור ל-node היעד להקלטה
        bypassNode.connect(this.destinationNode);

        // נסה למצוא ולחבר את כל ה-audio nodes האפשריים של הסאונד
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

        // אם לא הצלחנו לחבר, נסה להתחבר לאירועים
        if (!connected) {
          console.log(`Could not directly connect ${soundKey}, using events`);

          // התחבר לאירוע הפעלה
          sound.once("play", () => {
            console.log(`Sound ${soundKey} play event detected`);
            setTimeout(() => this.onSoundPlay(sound), 10);
          });

          // האזן גם לאירוע העצירה כדי שנוכל לנסות שוב אם מפעילים שוב
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

  /**
   * טיפול באירוע הפעלת סאונד
   */
  private onSoundPlay(sound: any): void {
    if (!this.audioContext || !this.destinationNode) return;

    const soundKey = sound.key || "unknown";

    // נסה שוב לחבר את הסאונד כשהוא כבר מופעל
    try {
      // בדוק אם יש לנו כבר נוד מעקף לסאונד הזה
      let bypassNode = this.bypassNodes.get(soundKey);
      if (!bypassNode) {
        bypassNode = this.audioContext.createGain();
        bypassNode.gain.value = 1.0;
        bypassNode.connect(this.destinationNode);
        this.bypassNodes.set(soundKey, bypassNode);
      }

      // נסה למצוא את המקור האמיתי של הסאונד כשהוא כבר מופעל
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
            return; // עצור אחרי חיבור מוצלח
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
   * ניקוי וסגירה
   */
  public destroy(): void {
    // נתק את כל נודי המעקף
    this.bypassNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch (e) {
        // התעלם משגיאות בניתוק
      }
    });
    this.bypassNodes.clear();

    // נתק את היעד להקלטה
    if (this.destinationNode) {
      try {
        this.destinationNode.disconnect();
      } catch (e) {
        // התעלם משגיאות בניתוק
      }
    }

    this.destinationNode = null;
    this.audioStream = null;
    this.ready = false;
    console.log("PhaserAudioRecorder resources released");
  }
}
