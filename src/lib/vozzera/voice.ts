import { MicDeviceSwitchFailedError } from "./voice-errors";

export type MicDevice = {
  deviceId: string;
  label: string;
};

export type MicCaptureOptions = {
  deviceId?: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  voiceIsolation?: boolean;
};

export type MicDeviceSwitcher = {
  switchActiveDevice(kind: "audioinput", deviceId: string): Promise<boolean>;
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
const SPEECH_SENSITIVITY_AUTO_KEY = "vozzera.speechSensitivityAuto";
const SPEECH_SENSITIVITY_DB_KEY = "vozzera.speechSensitivityDb";
const PUSH_TO_TALK_RELEASE_DELAY_KEY = "vozzera.pushToTalkReleaseDelayMs";
export const SPEECH_ON_DB = -50;
export const SPEECH_STAY_DB = -55;
export const SPEECH_HOLD_MS = 250;
export const SPEECH_POLL_INTERVAL_MS = 40;
export const SPEECH_BAND_LOW_HZ = 100;
export const SPEECH_BAND_HIGH_HZ = 4000;
export const MIN_SENSITIVITY_DB = -80;
export const MAX_SENSITIVITY_DB = -20;
const MANUAL_STAY_MARGIN_DB = 5;
export const DEFAULT_PUSH_TO_TALK_RELEASE_DELAY_MS = 200;
export const MAX_PUSH_TO_TALK_RELEASE_DELAY_MS = 2000;
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

export type SpeechThresholds = { onDb: number; stayDb: number };

export type SpeechState = { active: boolean; lastLoudAt: number | null };

export type SpeechSensitivity = { auto: boolean; thresholdDb: number };

export const SILENT_SPEECH_STATE: SpeechState = { active: false, lastLoudAt: null };

export const AUTOMATIC_SPEECH_THRESHOLDS: SpeechThresholds = {
  onDb: SPEECH_ON_DB,
  stayDb: SPEECH_STAY_DB,
};

export function rmsDbFs(samples: Float32Array): number {
  if (samples.length === 0) return -Infinity;
  let sumOfSquares = 0;
  for (const sample of samples) sumOfSquares += sample * sample;
  const rms = Math.sqrt(sumOfSquares / samples.length);
  return rms === 0 ? -Infinity : 20 * Math.log10(rms);
}

export function nextSpeechState(
  state: SpeechState,
  levelDb: number,
  now: number,
  thresholds: SpeechThresholds,
): SpeechState {
  const floorDb = state.active ? thresholds.stayDb : thresholds.onDb;
  if (levelDb >= floorDb) return { active: true, lastLoudAt: now };
  if (!state.active) return state;
  const quietSince = state.lastLoudAt ?? now;
  if (now - quietSince < SPEECH_HOLD_MS) return state;
  return SILENT_SPEECH_STATE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function speechThresholdsFor(sensitivity: SpeechSensitivity): SpeechThresholds {
  if (sensitivity.auto) return AUTOMATIC_SPEECH_THRESHOLDS;
  const onDb = clamp(sensitivity.thresholdDb, MIN_SENSITIVITY_DB, MAX_SENSITIVITY_DB);
  return { onDb, stayDb: onDb - MANUAL_STAY_MARGIN_DB };
}

export function levelToMeterPercent(levelDb: number): number {
  const fraction = (levelDb - MIN_SENSITIVITY_DB) / (MAX_SENSITIVITY_DB - MIN_SENSITIVITY_DB);
  return Math.round(clamp(fraction, 0, 1) * 100);
}

export function readSpeechSensitivity(storage: Storage | null): SpeechSensitivity {
  const fallback = { auto: true, thresholdDb: SPEECH_ON_DB };
  if (!storage) return fallback;
  const stored = Number(storage.getItem(SPEECH_SENSITIVITY_DB_KEY));
  const hasStoredLevel =
    storage.getItem(SPEECH_SENSITIVITY_DB_KEY) !== null && Number.isFinite(stored);
  return {
    auto: storage.getItem(SPEECH_SENSITIVITY_AUTO_KEY) !== "off",
    thresholdDb: hasStoredLevel
      ? clamp(stored, MIN_SENSITIVITY_DB, MAX_SENSITIVITY_DB)
      : fallback.thresholdDb,
  };
}

export function writeSpeechSensitivity(
  storage: Storage | null,
  sensitivity: SpeechSensitivity,
): void {
  if (!storage) return;
  storage.setItem(SPEECH_SENSITIVITY_AUTO_KEY, sensitivity.auto ? "on" : "off");
  storage.setItem(SPEECH_SENSITIVITY_DB_KEY, String(sensitivity.thresholdDb));
}

export function readPushToTalkReleaseDelayMs(storage: Storage | null): number {
  const raw = storage?.getItem(PUSH_TO_TALK_RELEASE_DELAY_KEY) ?? null;
  const stored = Number(raw);
  if (raw === null || !Number.isFinite(stored)) return DEFAULT_PUSH_TO_TALK_RELEASE_DELAY_MS;
  return clamp(stored, 0, MAX_PUSH_TO_TALK_RELEASE_DELAY_MS);
}

export function writePushToTalkReleaseDelayMs(storage: Storage | null, delayMs: number): void {
  if (!storage) return;
  const clamped = clamp(delayMs, 0, MAX_PUSH_TO_TALK_RELEASE_DELAY_MS);
  storage.setItem(PUSH_TO_TALK_RELEASE_DELAY_KEY, String(clamped));
}

export function roomAudioCaptureDefaults(): MicCaptureOptions {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    voiceIsolation: false,
  };
}

export function audioCaptureOptions(deviceId: string | null): MicCaptureOptions {
  return {
    ...(deviceId ? { deviceId } : {}),
    ...roomAudioCaptureDefaults(),
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

export async function applyMicDeviceChoice(params: {
  deviceId: string;
  room: MicDeviceSwitcher | null;
  storage: Storage | null;
  onSelected: (deviceId: string) => void;
}): Promise<void> {
  const { deviceId, room, storage, onSelected } = params;
  if (!room) {
    onSelected(deviceId);
    writeMicDeviceId(storage, deviceId);
    return;
  }
  const switched = await room.switchActiveDevice("audioinput", deviceId);
  if (!switched) throw new MicDeviceSwitchFailedError();
  onSelected(deviceId);
  writeMicDeviceId(storage, deviceId);
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

export function effectiveParticipantVolume(savedVolume: number | undefined): number {
  return savedVolume ?? 1;
}

type ParticipantMuteContext = {
  identity: string;
  isLocal: boolean;
  micEnabled: boolean;
  mutedParticipants: Record<string, boolean>;
};

export function isParticipantMuted({
  identity,
  isLocal,
  micEnabled,
  mutedParticipants,
}: ParticipantMuteContext): boolean {
  if (isLocal) return !micEnabled;
  return mutedParticipants[identity] === true;
}

export function isParticipantLocallyInaudible(
  isCurrentUser: boolean,
  savedVolume: number | undefined,
): boolean {
  if (isCurrentUser) return false;
  return savedVolume === 0;
}

export function microphoneEnabledAfterDeafenEnd(
  pushToTalkEnabled: boolean,
  previousMicEnabled: boolean,
): boolean {
  if (pushToTalkEnabled) return false;
  return previousMicEnabled;
}

export const DEAFEN_DATA_TOPIC = "vozzera.deafen";
export const PUSH_TO_TALK_DATA_TOPIC = "vozzera.ptt";

export function flagStatePayload(enabled: boolean): Uint8Array<ArrayBuffer> {
  return new Uint8Array([enabled ? 1 : 0]);
}

export function flagStateFromPayload(payload: Uint8Array): boolean | null {
  if (payload.length !== 1) return null;
  if (payload[0] === 1) return true;
  if (payload[0] === 0) return false;
  return null;
}

export const deafenStatePayload = flagStatePayload;
export const deafenStateFromPayload = flagStateFromPayload;
export const pushToTalkStatePayload = flagStatePayload;
export const pushToTalkStateFromPayload = flagStateFromPayload;

export function visibleMutedParticipants(
  mutedParticipants: Record<string, boolean>,
  pushToTalkParticipants: Record<string, boolean>,
): Record<string, boolean> {
  const idleIdentities = Object.keys(mutedParticipants).filter(
    (identity) => mutedParticipants[identity] && pushToTalkParticipants[identity] === true,
  );
  if (idleIdentities.length === 0) return mutedParticipants;
  const visible = { ...mutedParticipants };
  for (const identity of idleIdentities) visible[identity] = false;
  return visible;
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

export function initialMicEnabled(
  pushToTalkEnabled: boolean,
  requested: boolean | undefined,
): boolean {
  if (pushToTalkEnabled) return false;
  return requested ?? true;
}

type MicRestoreInputs = { deafen: boolean; micBeforeDeafen: boolean; micOn: boolean };

export function micEnabledToRestore({ deafen, micBeforeDeafen, micOn }: MicRestoreInputs): boolean {
  return deafen ? micBeforeDeafen : micOn;
}

export function localSpoke(speakerIdentities: string[], localIdentity: string): boolean {
  return speakerIdentities.includes(localIdentity);
}

export function remoteSpeakerIdentities(
  speakerIdentities: string[],
  localIdentity: string,
): string[] {
  return speakerIdentities.filter((identity) => identity !== localIdentity);
}
