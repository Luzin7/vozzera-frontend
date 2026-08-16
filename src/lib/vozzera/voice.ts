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

const NOISE_FILTER_KEY = "vozzera.noiseFilter";
const MIC_DEVICE_KEY = "vozzera.micDeviceId";

export function audioCaptureOptions(deviceId: string | null): MicCaptureOptions {
  return {
    ...(deviceId ? { deviceId } : {}),
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
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
