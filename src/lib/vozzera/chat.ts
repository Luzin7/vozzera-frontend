import type { ChatMessage, OutboundEvent, Room, VoiceParticipant } from "@/lib/vozzera/types";
import { MAX_FRAME_BYTES, outboundFrameSchema } from "@/lib/vozzera/ws-schema";
import { format, isSameDay, isValid, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export const SESSION_REVOKED_CLOSE_CODE = 4001;

export function isSessionRevokedClose(code: number): boolean {
  return code === SESSION_REVOKED_CLOSE_CODE;
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

export function firstUnreadMessageId(messages: ChatMessage[], unreadCount: number): string | null {
  if (unreadCount <= 0 || messages.length === 0) return null;
  const firstUnreadIndex = Math.max(0, messages.length - unreadCount);
  return messages[firstUnreadIndex]?.id ?? null;
}

export function firstTextRoom(rooms: Room[]): Room | undefined {
  return rooms.find((room) => !room.has_voice);
}

export function upsertRoom(rooms: Room[], room: Room): Room[] {
  if (!rooms.some((current) => current.id === room.id)) return [...rooms, room];
  return rooms.map((current) => (current.id === room.id ? { ...current, ...room } : current));
}

export function dateGroupLabelFor(timestamp: string, now = new Date()): string {
  const date = new Date(timestamp);
  if (!isValid(date)) return "";
  if (isSameDay(date, now)) return "Hoje";
  if (isSameDay(date, subDays(now, 1))) return "Ontem";
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
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

export function removeRoom<T>(state: Record<string, T>, roomId: string): Record<string, T> {
  if (!(roomId in state)) return state;
  const next = { ...state };
  delete next[roomId];
  return next;
}

export type VoicePresence = Record<string, VoiceParticipant[]>;

export function updateVoicePresence(
  presence: VoicePresence,
  event: Extract<OutboundEvent, { participants: VoiceParticipant[] }>,
): VoicePresence {
  const participants = Array.from(
    new Map(event.participants.map((participant) => [participant.user_id, participant])).values(),
  );

  if (participants.length === 0) return removeRoom(presence, event.room_id);
  return { ...presence, [event.room_id]: participants };
}

export type OnlineUser = { userId: string; username: string; online: boolean };
export type OnlineUsers = Record<string, OnlineUser>;

type UserIdentity = Omit<OnlineUser, "online">;

export function addOnlineUser(users: OnlineUsers, user: UserIdentity): OnlineUsers {
  const current = users[user.userId];
  if (current?.online && current.username === user.username) return users;
  return { ...users, [user.userId]: { ...user, online: true } };
}

export function removeOnlineUser(
  users: OnlineUsers,
  userId: string,
  username?: string,
): OnlineUsers {
  const current = users[userId];
  if (!current && !username) return users;
  if (current && !current.online) return users;
  return {
    ...users,
    [userId]: { userId, username: current?.username ?? username ?? "Usuário", online: false },
  };
}

export function replaceOnlineUsers(users: OnlineUsers, onlineUsers: UserIdentity[]): OnlineUsers {
  const next = Object.fromEntries(
    Object.entries(users).map(([userId, user]) => [userId, { ...user, online: false }]),
  );
  for (const user of onlineUsers) {
    next[user.userId] = { ...user, online: true };
  }
  return next;
}

export const TYPING_START_DELAY_MS = 1500;
export const TYPING_RESEND_INTERVAL_MS = 1000;
export const TYPING_STOP_DELAY_MS = 2000;
const TYPING_START_LIFETIME_MS = TYPING_RESEND_INTERVAL_MS + TYPING_STOP_DELAY_MS;

export type TypingUser = {
  userId: string;
  username: string;
  expiresAt: number;
};

export type TypingUsers = Record<string, Record<string, TypingUser>>;

function withTypingUser(users: TypingUsers, roomId: string, user: TypingUser): TypingUsers {
  return { ...users, [roomId]: { ...(users[roomId] ?? {}), [user.userId]: user } };
}

export function updateTypingUsers(
  users: TypingUsers,
  event: Extract<OutboundEvent, { type: "typing" }>,
  currentUserId: string | null,
  now: number,
): TypingUsers {
  if (event.user_id === currentUserId) return users;

  if (event.action === "start") {
    return withTypingUser(users, event.room_id, {
      userId: event.user_id,
      username: event.username,
      expiresAt: now + TYPING_START_LIFETIME_MS,
    });
  }

  const current = users[event.room_id]?.[event.user_id];
  if (!current) return users;

  return withTypingUser(users, event.room_id, {
    ...current,
    expiresAt: now + TYPING_STOP_DELAY_MS,
  });
}

export type TypingAction = "start" | "stop";

type TypingAnnouncerOptions = {
  send: (roomId: string, action: TypingAction) => void;
  startDelayMs: number;
  resendIntervalMs: number;
};

export type TypingAnnouncer = {
  typing: (roomId: string) => void;
  stop: () => void;
};

export function createTypingAnnouncer({
  send,
  startDelayMs,
  resendIntervalMs,
}: TypingAnnouncerOptions): TypingAnnouncer {
  let currentRoomId: string | null = null;
  let announced = false;
  let lastStartAt = 0;
  let pendingStart: ReturnType<typeof setTimeout> | null = null;

  const announce = (roomId: string) => {
    announced = true;
    lastStartAt = Date.now();
    send(roomId, "start");
  };

  const stop = () => {
    if (pendingStart) clearTimeout(pendingStart);
    pendingStart = null;
    if (announced && currentRoomId) send(currentRoomId, "stop");
    announced = false;
    currentRoomId = null;
  };

  const typing = (roomId: string) => {
    if (currentRoomId !== null && currentRoomId !== roomId) stop();

    if (announced) {
      if (Date.now() - lastStartAt >= resendIntervalMs) announce(roomId);
      return;
    }

    if (pendingStart) return;

    currentRoomId = roomId;
    pendingStart = setTimeout(() => {
      pendingStart = null;
      announce(roomId);
    }, startDelayMs);
  };

  return { typing, stop };
}

export function expireTypingUsers(users: TypingUsers, now: number): TypingUsers {
  let next = users;

  for (const [roomId, roomUsers] of Object.entries(users)) {
    for (const user of Object.values(roomUsers)) {
      if (now < user.expiresAt) continue;
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

export function removeTypingUser(users: TypingUsers, roomId: string, userId: string): TypingUsers {
  const roomUsers = users[roomId];
  if (!roomUsers || !(userId in roomUsers)) return users;

  const nextRoomUsers = { ...roomUsers };
  delete nextRoomUsers[userId];
  if (Object.keys(nextRoomUsers).length === 0) return removeRoom(users, roomId);
  return { ...users, [roomId]: nextRoomUsers };
}

export function parseFrame(raw: MessageEvent): OutboundEvent {
  const data = raw.data;

  if (typeof data !== "string") {
    throw new WebSocketProtocolError("O servidor enviou um frame WebSocket que não é texto.");
  }

  if (data.length > MAX_FRAME_BYTES) {
    throw new WebSocketProtocolError("O servidor enviou um frame WebSocket grande demais.");
  }

  try {
    return outboundFrameSchema.parse(JSON.parse(data));
  } catch {
    throw new WebSocketProtocolError("O servidor enviou um evento WebSocket incompatível.");
  }
}

export class WebSocketProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebSocketProtocolError";
  }
}
