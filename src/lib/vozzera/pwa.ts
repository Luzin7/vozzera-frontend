import type { NotificationStorage } from "@/lib/vozzera/notifications";

export const APP_BADGE_STORAGE_KEY = "vozzera:app-badge-enabled";
export const APP_THEME_COLOR = "#121417";

export type InstallOption = "installed" | "prompt" | "ios" | "unavailable";

type InstallContext = {
  standalone: boolean;
  promptAvailable: boolean;
  appleMobile: boolean;
};

export function installOptionFor({
  standalone,
  promptAvailable,
  appleMobile,
}: InstallContext): InstallOption {
  if (standalone) return "installed";
  if (promptAvailable) return "prompt";
  if (appleMobile) return "ios";
  return "unavailable";
}

export function appSettingsAvailable(installOption: InstallOption): boolean {
  return installOption !== "unavailable";
}

export function appBadgeAvailable(installOption: InstallOption): boolean {
  return installOption === "installed";
}

export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return userAgent.includes("Macintosh") && maxTouchPoints > 1;
}

export function launchTargetFor(targetUrl: string, currentUrl: string): string | null {
  const target = new URL(targetUrl);
  if (target.pathname === "/" && target.search === "") return null;
  if (target.href === new URL(currentUrl).href) return null;
  return target.href;
}

export function readAppBadgeEnabled(storage: NotificationStorage | null): boolean {
  if (storage === null) return true;
  return storage.getItem(APP_BADGE_STORAGE_KEY) !== "0";
}

export function writeAppBadgeEnabled(storage: NotificationStorage | null, enabled: boolean): void {
  if (storage === null) return;
  if (enabled) {
    storage.removeItem(APP_BADGE_STORAGE_KEY);
    return;
  }
  storage.setItem(APP_BADGE_STORAGE_KEY, "0");
}
