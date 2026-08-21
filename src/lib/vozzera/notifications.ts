export const NOTIFICATIONS_STORAGE_KEY = "vozzera:notifications-enabled";
export const SOUND_STORAGE_KEY = "vozzera:sound-enabled";

export type NotificationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readNotificationsEnabled(storage: NotificationStorage | null): boolean | null {
  if (storage === null) return null;

  const value = storage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export function writeNotificationsEnabled(
  storage: NotificationStorage | null,
  enabled: boolean,
): void {
  if (storage === null) return;

  if (enabled) storage.setItem(NOTIFICATIONS_STORAGE_KEY, "1");
  else storage.removeItem(NOTIFICATIONS_STORAGE_KEY);
}

export function readSoundEnabled(storage: NotificationStorage | null): boolean {
  if (storage === null) return false;
  return storage.getItem(SOUND_STORAGE_KEY) === "1";
}

export function writeSoundEnabled(storage: NotificationStorage | null, enabled: boolean): void {
  if (storage === null) return;
  if (enabled) storage.setItem(SOUND_STORAGE_KEY, "1");
  else storage.removeItem(SOUND_STORAGE_KEY);
}

export function notificationPermissionGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function initialNotificationsEnabled(storage: NotificationStorage | null): boolean {
  return readNotificationsEnabled(storage) ?? notificationPermissionGranted();
}

export function canNotify(enabled: boolean, hidden: boolean): boolean {
  return enabled && hidden && notificationPermissionGranted();
}

export function playMessageSound(): void {
  try {
    const audioCtx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // WebAudio pode falhar em ambientes sem suporte
  }
}
