type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
  for (const listener of listeners) listener();
}

export function captureInstallPrompt(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredPrompt(event as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => setDeferredPrompt(null));
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<void> {
  const event = deferredPrompt;
  if (!event) return;

  setDeferredPrompt(null);
  await event.prompt().catch(() => null);
}
