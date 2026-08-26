export type MicDevice = {
  deviceId: string;
  label: string;
};

export type MicCaptureOptions = {
  deviceId?: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
};

export type ScreenShareQuality = {
  width: number;
  height: number;
  frameRate: number;
};

type AudioPublishProfile = {
  audioPreset: { maxBitrate: number };
  dtx: boolean;
  forceStereo: boolean;
};

type ScreenSharePublishProfile = AudioPublishProfile & {
  degradationPreference: "maintain-framerate";
  screenShareEncoding: {
    maxBitrate: number;
    maxFramerate: number;
  };
};

const NOISE_FILTER_KEY = "vozzera.noiseFilter";
const MIC_DEVICE_KEY = "vozzera.micDeviceId";
const PARTICIPANT_VOLUMES_KEY = "vozzera.participantVolumes";
const SCREEN_SHARE_VOLUMES_KEY = "vozzera.screenShareVolumes";
const VOICE_START_LEVEL = 0.16;
const VOICE_CONTINUE_LEVEL = 0.07;
export const VOICE_RELEASE_DELAY_MS = 150;

export function isLocalVoiceActive(volume: number, wasActive: boolean): boolean {
  if (wasActive) return volume >= VOICE_CONTINUE_LEVEL;
  return volume >= VOICE_START_LEVEL;
}

export function shouldShowLocalVoiceActivity(
  hasVoiceLevel: boolean,
  wasVisible: boolean,
  silenceDurationMs: number,
): boolean {
  if (hasVoiceLevel) return true;
  if (!wasVisible) return false;
  return silenceDurationMs < VOICE_RELEASE_DELAY_MS;
}

export function mergeActiveSpeakerNames(currentNames: string[], activeNames: string[]): string[] {
  return Array.from(new Set([...currentNames, ...activeNames]));
}

export function audioCaptureOptions(deviceId: string | null): MicCaptureOptions {
  return {
    ...(deviceId ? { deviceId } : {}),
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

export function microphonePublishOptions(): AudioPublishProfile {
  return {
    audioPreset: { maxBitrate: 70_000 },
    dtx: true,
    forceStereo: false,
  };
}

export function screenShareAudioCaptureOptions(): MicCaptureOptions & {
  channelCount: number;
  restrictOwnAudio: boolean;
} {
  return {
    channelCount: 2,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    restrictOwnAudio: true,
  };
}

function screenShareVideoBitrate(quality: ScreenShareQuality): number {
  const isHighFrameRate = quality.frameRate > 30;
  const isFullHd = quality.width > 1280 || quality.height > 720;

  if (isHighFrameRate && isFullHd) return 10_000_000;
  if (isHighFrameRate || isFullHd) return 6_000_000;
  return 4_000_000;
}

export function screenSharePublishOptions(quality: ScreenShareQuality): ScreenSharePublishProfile {
  return {
    audioPreset: { maxBitrate: 128_000 },
    dtx: false,
    forceStereo: true,
    degradationPreference: "maintain-framerate",
    screenShareEncoding: {
      maxBitrate: screenShareVideoBitrate(quality),
      maxFramerate: quality.frameRate,
    },
  };
}

export function readNoiseFilter(storage: Storage | null): boolean {
  if (!storage) return true;
  return storage.getItem(NOISE_FILTER_KEY) !== "off";
}

export function writeNoiseFilter(storage: Storage | null, enabled: boolean): void {
  if (!storage) return;
  storage.setItem(NOISE_FILTER_KEY, enabled ? "on" : "off");
}

export function readMicDeviceId(storage: Storage | null): string | null {
  if (!storage) return null;
  return storage.getItem(MIC_DEVICE_KEY);
}

export function writeMicDeviceId(storage: Storage | null, deviceId: string): void {
  if (!storage) return;
  storage.setItem(MIC_DEVICE_KEY, deviceId);
}

function isVolumeMap(value: unknown): value is Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (volume) => typeof volume === "number" && volume >= 0 && volume <= 2,
  );
}

export function readParticipantVolumes(storage: Storage | null): Record<string, number> {
  if (!storage) return {};
  const raw = storage.getItem(PARTICIPANT_VOLUMES_KEY);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return isVolumeMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeParticipantVolumes(
  storage: Storage | null,
  volumes: Record<string, number>,
): void {
  if (!storage) return;
  storage.setItem(PARTICIPANT_VOLUMES_KEY, JSON.stringify(volumes));
}

export function readScreenShareVolumes(storage: Storage | null): Record<string, number> {
  if (!storage) return {};
  const raw = storage.getItem(SCREEN_SHARE_VOLUMES_KEY);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return isVolumeMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeScreenShareVolumes(
  storage: Storage | null,
  volumes: Record<string, number>,
): void {
  if (!storage) return;
  storage.setItem(SCREEN_SHARE_VOLUMES_KEY, JSON.stringify(volumes));
}

export function audioInputDevices(devices: MediaDeviceInfo[]): MicDevice[] {
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label || "Microfone padrão",
    }));
}

export function featuredShareId(
  selectedId: string | null,
  shares: Array<{ id: string }>,
): string | null {
  if (shares.length === 0) return null;
  if (selectedId && shares.some((share) => share.id === selectedId)) return selectedId;
  return shares[0]?.id ?? null;
}

export function muteVolume(muted: boolean, previousVolume: number | undefined): number {
  return muted ? 0 : (previousVolume ?? 1);
}

export function participantStatusLabelFor(locallyMuted: boolean, isSpeaking: boolean): string {
  if (locallyMuted) return "Silenciado para você";
  if (isSpeaking) return "Falando agora";
  return "Volume individual";
}
