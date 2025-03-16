import { Scene } from "phaser";

export class AudioManager {
  private mainScene: Scene;
  private audioContext?: AudioContext;
  private destination?: MediaStreamAudioDestinationNode;

  constructor(mainScene: Scene) {
    this.mainScene = mainScene;
  }

  async ensureAudioContext(): Promise<void> {
    if (!this.mainScene.sound) {
      throw new Error("Scene sound system is not initialized");
    }
    if (!("context" in this.mainScene.sound)) {
      throw new Error("Web Audio is not enabled. AudioContext is unavailable.");
    }
    this.audioContext = this.mainScene.sound.context as AudioContext;
    if (!this.audioContext) {
      throw new Error("AudioContext is not available in the scene");
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("AudioContext resumed successfully");
    }
  }

  isAudioReady(): boolean {
    return (
      !!this.audioContext &&
      this.audioContext.state === "running" &&
      !!this.mainScene.sound
    );
  }

  async getAudioStream(): Promise<MediaStream> {
    try {
      await this.ensureAudioContext();
      if (!this.audioContext) {
        throw new Error("AudioContext not initialized");
      }

      console.log(
        `AudioManager: AudioContext state: ${this.audioContext.state}`
      );

      // נסה לחדש שוב את האודיו קונטקסט אם צריך
      if (this.audioContext.state !== "running") {
        try {
          await this.audioContext.resume();
          console.log(
            `AudioManager: AudioContext resumed to state: ${this.audioContext.state}`
          );
        } catch (e) {
          console.error("Failed to resume AudioContext:", e);
        }
      }

      // נקה destination קודם אם יש
      if (this.destination) {
        console.log("AudioManager: Cleaning previous destination node");
        delete this.destination;
      }

      this.destination = this.audioContext.createMediaStreamDestination();
      console.log("AudioManager: Created new MediaStreamAudioDestinationNode");

      // גישה בטוחה יותר למערך הסאונדים
      const soundManager = this.mainScene.sound;
      const soundsArray = Array.isArray((soundManager as any).sounds)
        ? (soundManager as any).sounds
        : [];

      console.log(
        "Available sounds:",
        soundsArray.map((s: any) => ({
          key: s.key,
          isPlaying: s.isPlaying,
          type: s.constructor.name,
        }))
      );

      if (soundsArray.length === 0) {
        console.warn("No sounds found in the scene");
      }

      let connectedSounds = 0;

      // חיבור כל הסאונדים באמצעות זיהוי מדויק יותר
      soundsArray.forEach((sound: any) => {
        try {
          if (
            sound.constructor.name === "WebAudioSound" ||
            sound instanceof Phaser.Sound.WebAudioSound
          ) {
            // גישה ל-AudioNode המתאים
            if (sound.hasOwnProperty("_pan")) {
              // Phaser 3 גרסה חדשה יותר של
              const panNode = (sound as any)._pan;
              if (panNode && panNode.connect && this.destination) {
                panNode.connect(this.destination);
                connectedSounds++;
                console.log(`Connected sound via panNode: ${sound.key}`);
              }
            } else if (sound.hasOwnProperty("gain")) {
              const gainNode = (sound as any).gain;
              if (gainNode && gainNode.connect && this.destination) {
                gainNode.connect(this.destination);
                connectedSounds++;
                console.log(`Connected sound via gainNode: ${sound.key}`);
              }
            }
            // גישה ישירה למקור (השיטה הישנה או הגיבוי)
            else if (sound.source && sound.source.connect && this.destination) {
              sound.source.connect(this.destination);
              connectedSounds++;
              console.log(`Connected sound via source: ${sound.key}`);
            } else {
              console.warn(
                `Sound ${sound.key} is WebAudioSound but missing expected nodes`
              );

              // פתרון גיבוי - ניסיון לגשת באמצעות המאפיינים הפנימיים
              const internalProperties = Object.keys(sound).filter((k) =>
                k.startsWith("_")
              );
              console.log(
                `Internal properties for ${sound.key}:`,
                internalProperties
              );

              // חיפוש אחר נודים אפשריים לחיבור
              let connected = false;
              for (const prop of internalProperties) {
                const value = (sound as any)[prop];
                if (
                  value &&
                  typeof value === "object" &&
                  value.connect &&
                  typeof value.connect === "function"
                ) {
                  try {
                    value.connect(this.destination!);
                    connected = true;
                    connectedSounds++;
                    console.log(`Connected sound via ${prop}: ${sound.key}`);
                    break;
                  } catch (e) {
                    console.log(`Failed to connect via ${prop}:`, e);
                  }
                }
              }

              // נסיון נוסף - גש ל-AudioNode באמצעות ממשקים פנימיים
              if (!connected) {
                try {
                  // נסה לקבל את ה-AudioNode ישירות מהמאפיינים של WebAudioSound
                  if ((sound as any).getAudioNode) {
                    const node = (sound as any).getAudioNode();
                    if (node && this.destination) {
                      node.connect(this.destination);
                      connected = true;
                      connectedSounds++;
                      console.log(
                        `Connected sound via getAudioNode method: ${sound.key}`
                      );
                    }
                  }

                  // נסה לגשת למאפיינים נוספים שקיימים בגרסאות שונות של Phaser
                  const possibleNodeProps = [
                    "_gainNode",
                    "_muteNode",
                    "pannerNode",
                    "_output",
                  ];
                  for (const nodeProp of possibleNodeProps) {
                    if (!connected && (sound as any)[nodeProp]) {
                      const node = (sound as any)[nodeProp];
                      if (
                        node &&
                        typeof node.connect === "function" &&
                        this.destination
                      ) {
                        node.connect(this.destination);
                        connected = true;
                        connectedSounds++;
                        console.log(
                          `Connected sound via ${nodeProp}: ${sound.key}`
                        );
                        break;
                      }
                    }
                  }
                } catch (e) {
                  console.error("Error during advanced connection attempt:", e);
                }
              }

              if (!connected) {
                console.warn(
                  `Could not find any connectable nodes for sound ${sound.key}`
                );
              }
            }
          } else {
            console.log(
              `Sound ${sound.key} is not a WebAudioSound (type: ${sound.constructor.name})`
            );
          }
        } catch (error) {
          console.error(`Failed to connect sound ${sound.key}:`, error);
        }
      });

      if (connectedSounds === 0) {
        console.warn(
          "No WebAudio sounds were connected. Trying special solutions..."
        );

        // פתרון גיבוי - נסה ליצור קשר ישירות עם הקונטקסט
        if (this.audioContext && this.destination) {
          try {
            // בדוק אם הסאונד מנג'ר מחזיק ב-master gain
            const manager = this.mainScene.sound;
            if ((manager as any).masterVolumeNode) {
              (manager as any).masterVolumeNode.connect(this.destination);
              console.log("Connected master volume node to destination");
            }

            // פתרון מתקדם - יצירת OscillatorNode סמוי שיאפשר לנו לחבר את המערכת
            const dummyOscillator = this.audioContext.createOscillator();
            const dummyGain = this.audioContext.createGain();
            dummyGain.gain.value = 0; // העוצמה אפס כדי שלא יישמע

            // בנה מעקף חיבור למערכת הסאונד
            if ((manager as any).destination) {
              // הזרם הקלט של המנג'ר
              const managerDestination = (manager as any).destination;

              // חבר את האוסילטור לגיין ולאחר מכן הן ליעד המקורי והן ליעד ההקלטה
              dummyOscillator.connect(dummyGain);
              dummyGain.connect(managerDestination);
              dummyGain.connect(this.destination);

              // הפעל את האוסילטור
              dummyOscillator.start();

              console.log("Set up audio routing bypass system");

              // לניקוי מאוחר יותר
              setTimeout(() => {
                dummyOscillator.stop();
                dummyOscillator.disconnect();
                dummyGain.disconnect();
              }, 10000);
            }

            // גישה מתקדמת נוספת - ניסיון לתפוס את הסאונדים ישירות מהקונטקסט
            const contextAny = this.audioContext as any;
            if (contextAny && contextAny.destination) {
              // נסה לגשת למאפיינים פנימיים של הקונטקסט
              console.log("Attempting to access context internal nodes");
              const contextDestination = contextAny.destination;

              // יצירת מעקף
              const bypassGain = this.audioContext.createGain();
              bypassGain.gain.value = 1.0;

              // נסה למצוא את כל ה-nodes שאפשר לחבר
              for (const prop in contextAny) {
                if (
                  contextAny[prop] &&
                  typeof contextAny[prop] === "object" &&
                  typeof contextAny[prop].connect === "function"
                ) {
                  try {
                    contextAny[prop].connect(bypassGain);
                    console.log(`Connected context.${prop} to bypass gain`);
                  } catch (e) {
                    // התעלם משגיאות חיבור
                  }
                }
              }

              // חבר את ה-bypass gain ליעד ההקלטה
              bypassGain.connect(this.destination);
              console.log("Set up context-level audio routing");
            }
          } catch (e) {
            console.error("Failed to set up special audio routing:", e);
          }
        }

        // בכל מקרה, מומלץ ליצור סאונד חדש כדי לוודא שיש משהו ב-stream
        try {
          const syntheticSound = this.audioContext.createOscillator();
          const synthGain = this.audioContext.createGain();
          synthGain.gain.value = 0.01; // כמעט לא נשמע, אבל מספיק כדי ליצור stream

          syntheticSound.connect(synthGain);
          synthGain.connect(this.destination!);

          syntheticSound.start();

          // עצור אחרי זמן קצר
          setTimeout(() => {
            syntheticSound.stop();
            syntheticSound.disconnect();
            synthGain.disconnect();
          }, 5000);

          console.log("Created synthetic sound to ensure stream is active");
        } catch (e) {
          console.error("Failed to create synthetic sound:", e);
        }
      }

      if (!this.destination) {
        throw new Error("Destination node not initialized");
      }

      const stream = this.destination.stream;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn("No audio tracks available in the stream");
      } else {
        console.log(`Audio stream created with ${audioTracks.length} tracks`);
      }

      return stream;
    } catch (error) {
      console.error("Error in getAudioStream:", error);
      throw error;
    }
  }

  destroy(): void {
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext
        .close()
        .then(() => {
          console.log("AudioContext closed");
        })
        .catch((error) => {
          console.error("Failed to close AudioContext:", error);
        });
    }
    this.audioContext = undefined;
    this.destination = undefined;
  }
}
