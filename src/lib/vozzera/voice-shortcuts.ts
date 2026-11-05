export type VoiceShortcutAction = "toggle-mic" | "toggle-deafen";

export type ShortcutKeyEvent = {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  tagName: string | undefined;
  contentEditable: boolean;
};

const SHORTCUT_CODES: Record<string, VoiceShortcutAction> = {
  KeyM: "toggle-mic",
  KeyD: "toggle-deafen",
};

const SHORTCUT_KEY_LABELS: Record<VoiceShortcutAction, string> = {
  "toggle-mic": "M",
  "toggle-deafen": "D",
};

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function voiceShortcutFor(event: ShortcutKeyEvent): VoiceShortcutAction | null {
  if (event.repeat || event.altKey || !event.shiftKey) return null;
  if (!event.ctrlKey && !event.metaKey) return null;
  if (event.contentEditable) return null;
  if (event.tagName !== undefined && TYPING_TAGS.has(event.tagName)) return null;
  return SHORTCUT_CODES[event.code] ?? null;
}

export function voiceShortcutHint(action: VoiceShortcutAction, isMac: boolean): string {
  return `${isMac ? "⌘" : "Ctrl"}+Shift+${SHORTCUT_KEY_LABELS[action]}`;
}

export function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
}

export function labelWithShortcut(label: string, action: VoiceShortcutAction): string {
  return `${label} (${voiceShortcutHint(action, isMacPlatform())})`;
}
