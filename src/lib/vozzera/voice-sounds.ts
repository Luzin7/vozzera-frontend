import type { InactivityWarningTier } from "@/lib/vozzera/away";

export type VoiceActionSound =
  | "join"
  | "leave"
  | "mute"
  | "unmute"
  | "screen-share-start"
  | "screen-share-stop"
  | "inactivity-warn"
  | "inactivity-warn-urgent"
  | "inactivity-away";

export type VoiceActionNote = {
  frequency: number;
  startsAt: number;
  duration: number;
  gain: number;
};

export const VOICE_SOUND_ATTACK_SECONDS = 0.02;
export const VOICE_SOUND_RELEASE_SECONDS = 0.1;
export const SILENT_GAIN = 0.0001;

const SOUND_PROFILES: Record<VoiceActionSound, VoiceActionNote[]> = {
  join: [
    { frequency: 220, startsAt: 0, duration: 0.14, gain: 0.12 },
    { frequency: 330, startsAt: 0.11, duration: 0.2, gain: 0.13 },
  ],
  leave: [
    { frequency: 310, startsAt: 0, duration: 0.14, gain: 0.11 },
    { frequency: 195, startsAt: 0.11, duration: 0.2, gain: 0.12 },
  ],
  mute: [{ frequency: 155, startsAt: 0, duration: 0.18, gain: 0.125 }],
  unmute: [{ frequency: 260, startsAt: 0, duration: 0.18, gain: 0.125 }],
  "screen-share-start": [
    { frequency: 240, startsAt: 0, duration: 0.14, gain: 0.11 },
    { frequency: 360, startsAt: 0.09, duration: 0.22, gain: 0.13 },
  ],
  "screen-share-stop": [
    { frequency: 340, startsAt: 0, duration: 0.14, gain: 0.11 },
    { frequency: 210, startsAt: 0.09, duration: 0.22, gain: 0.12 },
  ],
  "inactivity-warn": [
    { frequency: 290, startsAt: 0, duration: 0.16, gain: 0.12 },
    { frequency: 230, startsAt: 0.16, duration: 0.2, gain: 0.11 },
  ],
  "inactivity-warn-urgent": [
    { frequency: 350, startsAt: 0, duration: 0.13, gain: 0.12 },
    { frequency: 350, startsAt: 0.18, duration: 0.13, gain: 0.12 },
    { frequency: 290, startsAt: 0.36, duration: 0.22, gain: 0.11 },
  ],
  "inactivity-away": [
    { frequency: 300, startsAt: 0, duration: 0.14, gain: 0.12 },
    { frequency: 220, startsAt: 0.13, duration: 0.18, gain: 0.11 },
    { frequency: 160, startsAt: 0.28, duration: 0.26, gain: 0.12 },
  ],
};

export function voiceActionNotesFor(action: VoiceActionSound): VoiceActionNote[] {
  return SOUND_PROFILES[action].map((note) => ({ ...note }));
}

export function soundForWarningTier(tier: InactivityWarningTier): VoiceActionSound {
  return tier === "warn-urgent" ? "inactivity-warn-urgent" : "inactivity-warn";
}

let sharedAudioContext: AudioContext | null = null;

function sharedContext(): AudioContext {
  if (sharedAudioContext) return sharedAudioContext;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  sharedAudioContext = new AudioContextConstructor();
  return sharedAudioContext;
}

export function primeVoiceSounds(): void {
  if (typeof window === "undefined") return;

  try {
    const audioContext = sharedContext();
    if (audioContext.state !== "suspended") return;
    audioContext.resume().catch(() => undefined);
  } catch {
    // WebAudio pode falhar em ambientes sem suporte
  }
}

export function playVoiceActionSound(action: VoiceActionSound): void {
  if (typeof window === "undefined") return;

  try {
    const audioContext = sharedContext();
    if (audioContext.state !== "running") {
      if (audioContext.state === "suspended") audioContext.resume().catch(() => undefined);
      return;
    }

    for (const note of voiceActionNotesFor(action)) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startTime = audioContext.currentTime + note.startsAt;
      const endTime = startTime + note.duration;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, startTime);
      gain.gain.setValueAtTime(SILENT_GAIN, startTime);
      gain.gain.linearRampToValueAtTime(note.gain, startTime + VOICE_SOUND_ATTACK_SECONDS);
      gain.gain.setValueAtTime(note.gain, endTime - VOICE_SOUND_RELEASE_SECONDS);
      gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, endTime);
      oscillator.start(startTime);
      oscillator.stop(endTime);
    }
  } catch {
    // WebAudio pode falhar em ambientes sem suporte
  }
}
