import type { ChatMessage, OutboundEvent, Room } from "@/lib/vozzera/types";
import { MAX_FRAME_BYTES, outboundFrameSchema } from "@/lib/vozzera/ws-schema";

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

export const ACTIVE_ROOM_STORAGE_KEY = "vozzera:active-room-id";

export type ActiveRoomStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readActiveRoomId(storage: ActiveRoomStorage | null): string | null {
  if (storage === null) return null;
  try {
    return storage.getItem(ACTIVE_ROOM_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveRoomId(storage: ActiveRoomStorage | null, roomId: string): void {
  if (storage === null) return;
  try {
    storage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
  } catch {
    // best-effort: armazenamento pode estar cheio ou desabilitado
  }
}

export function clearActiveRoomId(storage: ActiveRoomStorage | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function upsertRoom(rooms: Room[], room: Room): Room[] {
  if (!rooms.some((current) => current.id === room.id)) return [...rooms, room];
  return rooms.map((current) => (current.id === room.id ? { ...current, ...room } : current));
}

export function removeRoom<T>(state: Record<string, T>, roomId: string): Record<string, T> {
  if (!(roomId in state)) return state;
  const next = { ...state };
  delete next[roomId];
  return next;
}

export type TypingUser = {
  userId: string;
  username: string;
  lastTypedAt: number;
};

export type TypingUsers = Record<string, Record<string, TypingUser>>;

export function updateTypingUsers(
  users: TypingUsers,
  event: Extract<OutboundEvent, { type: "typing" }>,
  currentUserId: string | null,
  now: number,
): TypingUsers {
  if (event.user_id === currentUserId) return users;

  const roomUsers = users[event.room_id] ?? {};

  if (event.action === "start") {
    return {
      ...users,
      [event.room_id]: {
        ...roomUsers,
        [event.user_id]: {
          userId: event.user_id,
          username: event.username,
          lastTypedAt: now,
        },
      },
    };
  }

  return removeTypingUser(users, event.room_id, event.user_id);
}

export function expireTypingUsers(users: TypingUsers, now: number, timeout: number): TypingUsers {
  let next = users;

  for (const [roomId, roomUsers] of Object.entries(users)) {
    for (const user of Object.values(roomUsers)) {
      if (now - user.lastTypedAt < timeout) continue;
      next = removeTypingUser(next, roomId, user.userId);
    }
  }

  return next;
}

export function typingIndicatorText(users: TypingUser[]): string | null {
  const [first, second] = users;
  if (!first) return null;
  if (!second) return `${first.username} está digitando...`;
  if (users.length === 2) return `${first.username} e ${second.username} estão digitando...`;
  return "Várias pessoas estão digitando ao mesmo tempo...";
}

function removeTypingUser(users: TypingUsers, roomId: string, userId: string): TypingUsers {
  const roomUsers = users[roomId];
  if (!roomUsers || !(userId in roomUsers)) return users;

  const nextRoomUsers = { ...roomUsers };
  delete nextRoomUsers[userId];
  if (Object.keys(nextRoomUsers).length === 0) return removeRoom(users, roomId);
  return { ...users, [roomId]: nextRoomUsers };
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
