import dotSoundUrl from "./assets/sounds/dot.mp3";
import dashSoundUrl from "./assets/sounds/dash.mp3";
import menuSoundUrl from "./assets/sounds/menu.mp3";

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private dotAudio: HTMLAudioElement | null = null;
  private dashAudio: HTMLAudioElement | null = null;
  private menuAudio: HTMLAudioElement | null = null;

  constructor() {
    try {
      this.dotAudio = new Audio(dotSoundUrl);
      this.dashAudio = new Audio(dashSoundUrl);
      this.menuAudio = new Audio(menuSoundUrl);
    } catch {
      // Audio element not supported, will use Web Audio API fallback
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private playTone(frequency: number, durationMs: number, type: OscillatorType = "sine") {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio playback suppressed
    }
  }

  playDot(muted = false) {
    if (muted) return;
    if (this.dotAudio) {
      this.dotAudio.currentTime = 0;
      this.dotAudio.play().catch(() => {
        this.playTone(750, 70);
      });
    } else {
      this.playTone(750, 70);
    }
  }

  playDash(muted = false) {
    if (muted) return;
    if (this.dashAudio) {
      this.dashAudio.currentTime = 0;
      this.dashAudio.play().catch(() => {
        this.playTone(750, 220);
      });
    } else {
      this.playTone(750, 220);
    }
  }

  playMenu(muted = false) {
    if (muted) return;
    if (this.menuAudio) {
      this.menuAudio.currentTime = 0;
      this.menuAudio.play().catch(() => {
        this.playTone(520, 60);
      });
    } else {
      this.playTone(520, 60);
    }
  }

  playError(muted = false) {
    if (muted) return;
    this.playTone(220, 150, "sawtooth");
  }
}

export const sound = new SoundManager();

