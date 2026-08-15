export const NOTIFICATIONS_STORAGE_KEY = "vozzera:notifications-enabled";

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

export function notificationPermissionGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function initialNotificationsEnabled(storage: NotificationStorage | null): boolean {
  return readNotificationsEnabled(storage) ?? notificationPermissionGranted();
}

export function canNotify(enabled: boolean, hidden: boolean): boolean {
  return enabled && hidden && notificationPermissionGranted();
}
