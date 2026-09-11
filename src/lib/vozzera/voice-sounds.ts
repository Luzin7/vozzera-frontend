export type VoiceActionSound =
  "join" | "leave" | "mute" | "unmute" | "screen-share-start" | "screen-share-stop";

export type VoiceActionNote = {
  frequency: number;
  startsAt: number;
  duration: number;
  gain: number;
};

const SOUND_PROFILES: Record<VoiceActionSound, VoiceActionNote[]> = {
  join: [
    { frequency: 440, startsAt: 0, duration: 0.14, gain: 0.24 },
    { frequency: 660, startsAt: 0.11, duration: 0.2, gain: 0.26 },
  ],
  leave: [
    { frequency: 620, startsAt: 0, duration: 0.14, gain: 0.22 },
    { frequency: 390, startsAt: 0.11, duration: 0.2, gain: 0.24 },
  ],
  mute: [{ frequency: 310, startsAt: 0, duration: 0.18, gain: 0.25 }],
  unmute: [{ frequency: 520, startsAt: 0, duration: 0.18, gain: 0.25 }],
  "screen-share-start": [
    { frequency: 480, startsAt: 0, duration: 0.12, gain: 0.22 },
    { frequency: 720, startsAt: 0.09, duration: 0.22, gain: 0.26 },
  ],
  "screen-share-stop": [
    { frequency: 680, startsAt: 0, duration: 0.12, gain: 0.22 },
    { frequency: 420, startsAt: 0.09, duration: 0.22, gain: 0.24 },
  ],
};

export function voiceActionNotesFor(action: VoiceActionSound): VoiceActionNote[] {
  return SOUND_PROFILES[action].map((note) => ({ ...note }));
}

export function playVoiceActionSound(action: VoiceActionSound): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextConstructor();
    const notes = voiceActionNotesFor(action);
    const finalNote = notes[notes.length - 1];

    for (const note of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startTime = audioContext.currentTime + note.startsAt;
      const endTime = startTime + note.duration;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, startTime);
      gain.gain.setValueAtTime(note.gain, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, endTime);
      oscillator.start(startTime);
      oscillator.stop(endTime);
    }

    if (!finalNote) return;
    window.setTimeout(
      () => void audioContext.close(),
      (finalNote.startsAt + finalNote.duration) * 1000 + 50,
    );
  } catch {
    // WebAudio pode falhar em ambientes sem suporte
  }
}
