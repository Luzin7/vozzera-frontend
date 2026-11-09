import { describe, expect, it } from "vitest";

import {
  createDraftStore,
  editorKeyAction,
  formatEditedAt,
  formatMessageDateTime,
  formatMessageTime,
  lastOwnMessage,
  MESSAGE_GROUP_MAX_GAP_MS,
  shouldGroupMessages,
  wasEdited,
} from "@/lib/vozzera/message-display";
import type { ChatMessage } from "@/lib/vozzera/types";

function at(hour: number, minute: number, day = 5): string {
  return new Date(2026, 10, day, hour, minute).toISOString();
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    roomId: "r1",
    userId: "u1",
    username: "luan",
    content: "oi",
    createdAt: at(10, 0),
    updatedAt: "",
    replyTo: null,
    ...overrides,
  };
}

describe("shouldGroupMessages", () => {
  it("groups the same author within the gap", () => {
    const previous = message({ createdAt: at(10, 0) });
    expect(shouldGroupMessages(previous, message({ createdAt: at(10, 7) }))).toBe(true);
  });

  it("breaks the group when the gap is above 7 minutes", () => {
    const previous = message({ createdAt: at(10, 0) });
    expect(shouldGroupMessages(previous, message({ createdAt: at(10, 8) }))).toBe(false);
    expect(MESSAGE_GROUP_MAX_GAP_MS).toBe(7 * 60_000);
  });

  it("breaks the group when the day changes even within the gap", () => {
    const previous = message({ createdAt: at(23, 58) });
    expect(shouldGroupMessages(previous, message({ createdAt: at(0, 3, 6) }))).toBe(false);
  });

  it("breaks the group for a different author", () => {
    expect(shouldGroupMessages(message(), message({ userId: "u2", createdAt: at(10, 1) }))).toBe(
      false,
    );
  });

  it("does not group without a previous message", () => {
    expect(shouldGroupMessages(undefined, message())).toBe(false);
  });

  it("does not group when a date is invalid", () => {
    expect(shouldGroupMessages(message(), message({ createdAt: "x" }))).toBe(false);
  });
});

describe("wasEdited", () => {
  it("is true only when updatedAt is after createdAt", () => {
    expect(wasEdited(message({ updatedAt: at(10, 5) }))).toBe(true);
    expect(wasEdited(message({ updatedAt: at(10, 0) }))).toBe(false);
    expect(wasEdited(message({ updatedAt: "" }))).toBe(false);
    expect(wasEdited(message({ updatedAt: "x" }))).toBe(false);
  });
});

describe("lastOwnMessage", () => {
  it("returns the latest message of the user", () => {
    const messages = [
      message({ id: "a" }),
      message({ id: "b", username: "ana" }),
      message({ id: "c" }),
      message({ id: "d", username: "ana" }),
    ];
    expect(lastOwnMessage(messages, "luan")?.id).toBe("c");
  });

  it("returns undefined when there is none", () => {
    expect(lastOwnMessage([message({ username: "ana" })], "luan")).toBeUndefined();
    expect(lastOwnMessage([message()], null)).toBeUndefined();
  });
});

describe("createDraftStore", () => {
  it("keeps one draft per room", () => {
    const drafts = createDraftStore();
    drafts.set("a", "um");
    drafts.set("b", "dois");
    expect(drafts.get("a")).toBe("um");
    expect(drafts.get("b")).toBe("dois");
  });

  it("returns an empty draft for unknown rooms", () => {
    expect(createDraftStore().get("x")).toBe("");
  });

  it("clears a draft when set to empty", () => {
    const drafts = createDraftStore();
    drafts.set("a", "um");
    drafts.set("a", "");
    expect(drafts.get("a")).toBe("");
  });

  it("clears one room only", () => {
    const drafts = createDraftStore();
    drafts.set("a", "um");
    drafts.set("b", "dois");
    drafts.clear("a");
    expect(drafts.get("a")).toBe("");
    expect(drafts.get("b")).toBe("dois");
  });
});

describe("createDraftStore clearAll", () => {
  it("drops every draft", () => {
    const drafts = createDraftStore();
    drafts.set("a", "um");
    drafts.set("b", "dois");
    drafts.clearAll();
    expect(drafts.get("a")).toBe("");
    expect(drafts.get("b")).toBe("");
  });
});

describe("editorKeyAction", () => {
  it("saves on Enter, cancels on Escape", () => {
    expect(editorKeyAction({ key: "Enter", shiftKey: false, isComposing: false })).toBe("save");
    expect(editorKeyAction({ key: "Escape", shiftKey: false, isComposing: false })).toBe("cancel");
  });

  it("lets Shift+Enter insert a newline", () => {
    expect(editorKeyAction({ key: "Enter", shiftKey: true, isComposing: false })).toBeNull();
  });

  it("ignores Enter and Escape while composing", () => {
    expect(editorKeyAction({ key: "Enter", shiftKey: false, isComposing: true })).toBeNull();
    expect(editorKeyAction({ key: "Escape", shiftKey: false, isComposing: true })).toBeNull();
  });
});

describe("timezone formatting", () => {
  const iso = "2026-11-05T02:30:00Z";

  it("formats the visible time in the given timezone", () => {
    expect(formatMessageTime(iso, "UTC")).toBe("02:30");
    expect(formatMessageTime(iso, "America/Sao_Paulo")).toBe("23:30");
  });

  it("formats the edit tooltip in the same given timezone", () => {
    expect(formatEditedAt(iso, "UTC")).toContain("02:30");
    expect(formatEditedAt(iso, "America/Sao_Paulo")).toContain("23:30");
  });

  it("formats the full date tooltip in the given timezone", () => {
    expect(formatMessageDateTime(iso, "UTC")).toContain("02:30");
    expect(formatMessageDateTime(iso, "America/Sao_Paulo")).toContain("23:30");
    expect(formatMessageDateTime(iso, "UTC")).not.toContain("Editada");
  });

  it("returns empty for an invalid date", () => {
    expect(formatMessageDateTime("x", "UTC")).toBe("");
    expect(formatMessageTime("x", "UTC")).toBe("");
    expect(formatEditedAt("x", "UTC")).toBe("");
  });
});
