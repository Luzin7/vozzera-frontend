import type { ChatMessage, OutboundEvent, Room } from "./types";
import { MAX_FRAME_BYTES, outboundFrameSchema } from "./ws-schema";

export function appendMessage(
  messages: Record<string, ChatMessage[]>,
  message: ChatMessage,
): Record<string, ChatMessage[]> {
  const current = messages[message.roomId] ?? [];
  if (current.some((m) => m.id === message.id)) return messages;
  return { ...messages, [message.roomId]: [...current, message] };
}

export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15000);
}

export function nextRoomIndex(key: string, currentIndex: number, length: number): number | null {
  if (key === "ArrowDown") return currentIndex + 1 < length ? currentIndex + 1 : 0;
  if (key === "ArrowUp") return currentIndex - 1 >= 0 ? currentIndex - 1 : length - 1;
  return null;
}

export function incrementUnread(
  unread: Record<string, number>,
  roomId: string,
): Record<string, number> {
  return { ...unread, [roomId]: (unread[roomId] ?? 0) + 1 };
}

export function clearUnread(
  unread: Record<string, number>,
  roomId: string,
): Record<string, number> {
  if (!(roomId in unread)) return unread;
  const next = { ...unread };
  delete next[roomId];
  return next;
}

export function totalUnread(unread: Record<string, number>): number {
  return Object.values(unread).reduce((sum, count) => sum + count, 0);
}

export function firstTextRoom(rooms: Room[]): Room | undefined {
  return rooms.find((room) => room.type === "text");
}

export function parseFrame(raw: MessageEvent): OutboundEvent | null {
  const data = raw.data as string;

  if (data.length > MAX_FRAME_BYTES) return null;

  try {
    return outboundFrameSchema.parse(JSON.parse(data)) as OutboundEvent;
  } catch {
    return null;
  }
}
