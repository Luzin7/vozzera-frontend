import { isSameDay } from "date-fns";

import type { ChatMessage } from "@/lib/vozzera/types";

export const MESSAGE_GROUP_MAX_GAP_MS = 7 * 60_000;

export function shouldGroupMessages(
  previous: ChatMessage | undefined,
  current: ChatMessage,
): boolean {
  if (!previous || previous.userId !== current.userId) return false;

  const previousAt = new Date(previous.createdAt);
  const currentAt = new Date(current.createdAt);
  const gap = currentAt.getTime() - previousAt.getTime();
  if (Number.isNaN(gap)) return false;

  return gap <= MESSAGE_GROUP_MAX_GAP_MS && isSameDay(previousAt, currentAt);
}

export function wasEdited(message: ChatMessage): boolean {
  const updatedAt = Date.parse(message.updatedAt);
  const createdAt = Date.parse(message.createdAt);
  if (Number.isNaN(updatedAt) || Number.isNaN(createdAt)) return false;
  return updatedAt > createdAt;
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatMessageTime(iso: string, timeZone: string = browserTimeZone()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
}

export function formatMessageDateTime(iso: string, timeZone: string = browserTimeZone()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" });
}

export function formatEditedAt(iso: string, timeZone: string = browserTimeZone()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `Editada em ${date.toLocaleString("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  })}`;
}

export type EditorKeyAction = "save" | "cancel" | null;

export function editorKeyAction({
  key,
  shiftKey,
  isComposing,
}: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}): EditorKeyAction {
  if (isComposing) return null;
  if (key === "Enter" && !shiftKey) return "save";
  if (key === "Escape") return "cancel";
  return null;
}

export function lastOwnMessage(
  messages: ChatMessage[],
  username: string | null,
): ChatMessage | undefined {
  if (!username) return undefined;
  const own = messages.filter((message) => message.username === username);
  return own[own.length - 1];
}

export type DraftStore = {
  get: (roomId: string) => string;
  set: (roomId: string, text: string) => void;
  clear: (roomId: string) => void;
  clearAll: () => void;
};

export function createDraftStore(): DraftStore {
  const drafts = new Map<string, string>();

  return {
    get: (roomId) => drafts.get(roomId) ?? "",
    set: (roomId, text) => {
      if (text === "") {
        drafts.delete(roomId);
        return;
      }
      drafts.set(roomId, text);
    },
    clear: (roomId) => {
      drafts.delete(roomId);
    },
    clearAll: () => {
      drafts.clear();
    },
  };
}
