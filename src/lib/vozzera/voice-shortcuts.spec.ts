import { describe, expect, it } from "vitest";

import { labelWithShortcut, voiceShortcutFor, voiceShortcutHint } from "./voice-shortcuts";
import type { ShortcutKeyEvent } from "./voice-shortcuts";

function keyEvent(overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return {
    code: "KeyM",
    ctrlKey: true,
    metaKey: false,
    shiftKey: true,
    altKey: false,
    repeat: false,
    tagName: "DIV",
    contentEditable: false,
    ...overrides,
  };
}

describe("voiceShortcutFor", () => {
  it("maps Ctrl+Shift+M to mic and Ctrl+Shift+D to deafen", () => {
    expect(voiceShortcutFor(keyEvent())).toBe("toggle-mic");
    expect(voiceShortcutFor(keyEvent({ code: "KeyD" }))).toBe("toggle-deafen");
  });

  it("accepts Cmd in place of Ctrl", () => {
    expect(voiceShortcutFor(keyEvent({ ctrlKey: false, metaKey: true }))).toBe("toggle-mic");
  });

  it("requires Shift and a Ctrl or Cmd modifier, and no Alt", () => {
    expect(voiceShortcutFor(keyEvent({ shiftKey: false }))).toBeNull();
    expect(voiceShortcutFor(keyEvent({ ctrlKey: false }))).toBeNull();
    expect(voiceShortcutFor(keyEvent({ altKey: true }))).toBeNull();
  });

  it("ignores other keys and key repeats", () => {
    expect(voiceShortcutFor(keyEvent({ code: "KeyV" }))).toBeNull();
    expect(voiceShortcutFor(keyEvent({ repeat: true }))).toBeNull();
  });

  it("ignores typing targets", () => {
    expect(voiceShortcutFor(keyEvent({ tagName: "INPUT" }))).toBeNull();
    expect(voiceShortcutFor(keyEvent({ tagName: "TEXTAREA" }))).toBeNull();
    expect(voiceShortcutFor(keyEvent({ contentEditable: true }))).toBeNull();
    expect(voiceShortcutFor(keyEvent({ tagName: undefined }))).toBe("toggle-mic");
  });
});

describe("voiceShortcutHint", () => {
  it("names the modifier of the platform", () => {
    expect(voiceShortcutHint("toggle-mic", false)).toBe("Ctrl+Shift+M");
    expect(voiceShortcutHint("toggle-deafen", true)).toBe("⌘+Shift+D");
  });
});

describe("labelWithShortcut", () => {
  it("appends the shortcut to the label", () => {
    expect(labelWithShortcut("Silenciar", "toggle-mic")).toBe("Silenciar (Ctrl+Shift+M)");
  });
});
