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

export type DegradationPreference = "maintain-framerate" | "maintain-resolution";

export type ScreenShareIntent = "text" | "video" | "economy";

export type ScreenShareQuality = {
  width: number;
  height: number;
  frameRate: number;
  degradationPreference?: DegradationPreference;
};

type AudioPublishProfile = {
  audioPreset: { maxBitrate: number };
  dtx: boolean;
  forceStereo: boolean;
};

type ScreenSharePublishProfile = AudioPublishProfile & {
  degradationPreference: "maintain-framerate" | "maintain-resolution";
  screenShareEncoding: {
    maxBitrate: number;
    maxFramerate: number;
  };
  videoCodec: "h264";
  simulcast: true;
};

type ScreenShareAdaptiveStreamSettings = {
  pauseVideoInBackground: false;
};

export type ScreenShareContentHint = "motion" | "detail";

export type ScreenShareProfile = {
  constraints: { width: number; height: number; frameRate: number };
  encoding: { maxBitrate: number; maxFramerate: number };
  degradationPreference: DegradationPreference;
  contentHint: ScreenShareContentHint;
  displaySurface: "window" | "monitor";
};

export type ScreenShareHealth = "ok" | "cpu" | "bandwidth" | "paused";

export type ScreenShareSenderStats = {
  qualityLimitationReason?: string | undefined;
  paused?: boolean;
};

const NOISE_FILTER_KEY = "vozzera.noiseFilter";
const MIC_DEVICE_KEY = "vozzera.micDeviceId";
const PUSH_TO_TALK_KEY = "vozzera.pushToTalk";
const PUSH_TO_TALK_CODE_KEY = "vozzera.pushToTalkCode";
const PUSH_TO_TALK_LABEL_KEY = "vozzera.pushToTalkLabel";
const PARTICIPANT_VOLUMES_KEY = "vozzera.participantVolumes";
const SCREEN_SHARE_VOLUMES_KEY = "vozzera.screenShareVolumes";
const VOICE_START_LEVEL = 0.16;
const VOICE_CONTINUE_LEVEL = 0.07;
export const VOICE_RELEASE_DELAY_MS = 40;
export const VIDEO_PLAYBACK_DELAY_MS = 200;
export const DEFAULT_PUSH_TO_TALK_BINDING = { code: "KeyV", label: "V" } as const;

export type PushToTalkBinding = { code: string; label: string };

export function shouldHandlePushToTalk(
  code: string,
  bindingCode: string,
  repeat: boolean,
  tagName: string | undefined,
  contentEditable: boolean,
): boolean {
  if (code !== bindingCode || repeat || contentEditable) return false;
  return tagName !== "INPUT" && tagName !== "TEXTAREA" && tagName !== "SELECT";
}

export function pushToTalkLabelFor(key: string, code: string): string {
  if (code === "Space") return "Espaço";
  if (key.length === 1) return key.toLocaleUpperCase("pt-BR");
  return key;
}

export function readPushToTalkBinding(storage: Storage | null): PushToTalkBinding {
  if (!storage) return DEFAULT_PUSH_TO_TALK_BINDING;
  const code = storage.getItem(PUSH_TO_TALK_CODE_KEY);
  const label = storage.getItem(PUSH_TO_TALK_LABEL_KEY);
  if (!code || !label) return DEFAULT_PUSH_TO_TALK_BINDING;
  return { code, label };
}

export function writePushToTalkBinding(storage: Storage | null, binding: PushToTalkBinding): void {
  if (!storage) return;
  storage.setItem(PUSH_TO_TALK_CODE_KEY, binding.code);
  storage.setItem(PUSH_TO_TALK_LABEL_KEY, binding.label);
}

export function readPushToTalkEnabled(storage: Storage | null): boolean {
  if (!storage) return false;
  return storage.getItem(PUSH_TO_TALK_KEY) === "1";
}

export function writePushToTalkEnabled(storage: Storage | null, enabled: boolean): void {
  if (!storage) return;
  if (enabled) {
    storage.setItem(PUSH_TO_TALK_KEY, "1");
    return;
  }
  storage.removeItem(PUSH_TO_TALK_KEY);
}

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

export function shouldReleaseMicrophoneInBackground(hidden: boolean): boolean {
  return hidden;
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
  if (quality.height >= 1080) {
    if (quality.frameRate >= 60) return 8_000_000;
    if (quality.frameRate <= 15) return 3_000_000;
    return 5_000_000;
  }
  if (quality.height >= 720) return quality.frameRate >= 60 ? 4_500_000 : 2_000_000;
  return 800_000;
}

export function screenShareContentHintFor(
  degradationPreference: DegradationPreference,
): ScreenShareContentHint {
  if (degradationPreference === "maintain-resolution") return "detail";
  return "motion";
}

const SCREEN_SHARE_INTENT_QUALITIES: Record<ScreenShareIntent, ScreenShareQuality> = {
  text: { width: 1920, height: 1080, frameRate: 15, degradationPreference: "maintain-resolution" },
  video: { width: 1920, height: 1080, frameRate: 60, degradationPreference: "maintain-framerate" },
  economy: {
    width: 1280,
    height: 720,
    frameRate: 30,
    degradationPreference: "maintain-resolution",
  },
};

export function screenShareQualityFor(intent: ScreenShareIntent): ScreenShareQuality {
  return SCREEN_SHARE_INTENT_QUALITIES[intent];
}

export function screenShareProfileFor(intent: ScreenShareIntent): ScreenShareProfile {
  const quality = screenShareQualityFor(intent);
  const degradationPreference = quality.degradationPreference ?? "maintain-framerate";

  return {
    constraints: { width: quality.width, height: quality.height, frameRate: quality.frameRate },
    encoding: { maxBitrate: screenShareVideoBitrate(quality), maxFramerate: quality.frameRate },
    degradationPreference,
    contentHint: screenShareContentHintFor(degradationPreference),
    displaySurface: "window",
  };
}

export function screenSharePublishOptions(intent: ScreenShareIntent): ScreenSharePublishProfile {
  const profile = screenShareProfileFor(intent);

  return {
    audioPreset: { maxBitrate: 128_000 },
    dtx: false,
    forceStereo: true,
    degradationPreference: profile.degradationPreference,
    screenShareEncoding: profile.encoding,
    videoCodec: "h264",
    simulcast: true,
  };
}

export function screenShareAdaptiveStreamSettings(): ScreenShareAdaptiveStreamSettings {
  return { pauseVideoInBackground: false };
}

export function screenShareHealthFor(stats: ScreenShareSenderStats): ScreenShareHealth {
  if (stats.paused) return "paused";
  if (stats.qualityLimitationReason === "cpu") return "cpu";
  if (stats.qualityLimitationReason === "bandwidth") return "bandwidth";
  return "ok";
}

export function screenShareHealthMessageFor(health: ScreenShareHealth): string | null {
  if (health === "cpu") return "Seu computador está no limite.";
  if (health === "bandwidth") return "Sua internet de upload está limitando a qualidade.";
  if (health === "paused") return "Sua conexão não está dando conta. A transmissão volta sozinha.";
  return null;
}

export function participantConnectionWarningFor(
  quality: string | undefined,
  name: string,
): string | null {
  if (quality !== "poor") return null;
  return `A conexão de ${name} está instável.`;
}

export function canShareScreen(
  mediaDevices: { getDisplayMedia?: unknown } | null | undefined,
): boolean {
  return typeof mediaDevices?.getDisplayMedia === "function";
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

export function effectiveParticipantVolume(
  deafen: boolean,
  savedVolume: number | undefined,
): number {
  if (deafen) return 0;
  return savedVolume ?? 1;
}

export function isParticipantLocallyInaudible(
  isCurrentUser: boolean,
  deafen: boolean,
  savedVolume: number | undefined,
): boolean {
  if (isCurrentUser) return false;
  return deafen || savedVolume === 0;
}

export function participantNamesToMuteForSelectiveListening(
  participantNames: string[],
  selectedName: string,
): string[] {
  return participantNames.filter((name) => name !== selectedName);
}

export function microphoneEnabledAfterDeafenToggle(deafenActive: boolean): boolean {
  return deafenActive;
}

export function locallyMutedParticipantNames(volumes: Record<string, number>): string[] {
  return Object.entries(volumes)
    .filter(([, volume]) => volume === 0)
    .map(([name]) => name);
}

export function isGlobalMuteActive(
  microphoneEnabled: boolean,
  participantNames: string[],
  participantVolumes: Record<string, number>,
  screenShareNames: string[],
  screenShareVolumes: Record<string, number>,
): boolean {
  if (microphoneEnabled) return false;
  if (participantNames.some((name) => participantVolumes[name] !== 0)) return false;
  return screenShareNames.every((name) => screenShareVolumes[name] === 0);
}

type HasPlayoutDelay = {
  setPlayoutDelay(delayInSeconds: number): void;
};

export function applyVideoPlaybackDelay(track: HasPlayoutDelay, delayMs: number): void {
  track.setPlayoutDelay(delayMs / 1000);
}

export function participantStatusLabelFor(locallyMuted: boolean, isSpeaking: boolean): string {
  if (locallyMuted) return "Silenciado para você";
  if (isSpeaking) return "Falando agora";
  return "Volume individual";
}

export function applyVolumeWithElementMuted(
  element: HTMLAudioElement,
  applyVolume: () => void,
): void {
  element.volume = 0;
  applyVolume();
  element.volume = 1;
}
