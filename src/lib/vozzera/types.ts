export type Room = {
  id: string;
  name: string;
  type: "text" | "voice";
  created_at: string;
  updated_at?: string | null;
};

export type UserRole = "user" | "mod" | "admin";

export type CurrentUser = {
  id: string;
  username: string;
  role: UserRole;
  email: string;
};

export type UpdateEmailResponse = {
  message: string;
  email: string;
};

export type HistoryMessage = {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
  username: string;
};

export type LoginResponse = {
  message: string;
  id: string;
  username: string;
};

export type RegisterResponse = {
  message: string;
  id: string;
};

export type RegisterRequest = {
  username: string;
  password: string;
  email: string;
  inviteCode: string;
};

export type MessageAction = "created" | "updated" | "deleted";

export type InboundEvent =
  | {
      type: "join";
      room_id: string;
    }
  | {
      type: "message";
      room_id: string;
      content: string;
    }
  | {
      type: "typing";
      room_id: string;
      action: "start" | "stop";
    };

export type OutboundEvent =
  | {
      type: "room";
      action: "created" | "updated";
      id: string;
      name: string;
      room_type: "text" | "voice";
    }
  | {
      type: "room";
      action: "deleted";
      id: string;
    }
  | {
      type: "message";
      action: "created";
      id: string;
      room_id: string;
      user_id: string;
      username: string;
      content: string;
      created_at: string;
      updated_at?: string;
    }
  | {
      type: "message";
      action: "updated";
      id: string;
      room_id: string;
      user_id: string;
      content: string;
      updated_at?: string;
    }
  | {
      type: "message";
      action: "deleted";
      id: string;
      room_id: string;
      user_id: string;
      updated_at?: string;
    }
  | {
      type: "presence";
      id: string;
      room_id: string;
      user_id: string;
      username: string;
    }
  | {
      type: "typing";
      action: "start" | "stop";
      room_id: string;
      user_id: string;
      username: string;
    }
  | {
      type: "error";
      error: string;
    };

export const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export type VoiceTokenResponse = {
  token: string;
  url: string;
  room_name: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export const fromHistory = (m: HistoryMessage, roomId: string): ChatMessage => ({
  id: m.id,
  roomId,
  userId: m.user_id,
  username: m.username,
  content: m.content,
  createdAt: m.created_at,
  updatedAt: m.updated_at ?? "",
});

export const fromEvent = (
  e: Extract<OutboundEvent, { type: "message"; action: "created" }>,
): ChatMessage => ({
  id: e.id,
  roomId: e.room_id,
  userId: e.user_id,
  username: e.username,
  content: e.content,
  createdAt: e.created_at,
  updatedAt: e.updated_at ?? "",
});

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ROOM_NAME_LENGTH = 100;
export const MAX_USERNAME_LENGTH = 50;
export const MAX_LOGIN_IDENTIFIER_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 8;
