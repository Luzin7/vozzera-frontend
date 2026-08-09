// Tipos do contrato do backend Vozzera (Go).

export type Room = {
  id: string;
  name: string;
  type: "text" | "voice";
  created_at: string;
};

export type HistoryMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  // atenção: NÃO tem room_id
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

export type InboundEvent =
  | { type: "join"; room_id: string }
  | { type: "message"; room_id: string; content: string };

export type OutboundEvent = {
  type: "message" | "presence" | "error";
  id: string; // sempre presente; zeros quando não se aplica
  room_id: string; // idem
  user_id: string; // idem
  created_at: string; // idem ("0001-01-01T00:00:00Z")
  username?: string;
  content?: string;
  error?: string;
};

export const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** Resposta de POST /api/voice/token */
export type VoiceTokenResponse = {
  token: string; // JWT do LiveKit
  url: string; // wss://<projeto>.livekit.cloud
  room_name: string; // só pra exibir; a sala real é o UUID, já dentro do token
};


/** Shape unificado (histórico REST + eventos WS) usado no estado do front. */
export type ChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
};

export const fromHistory = (m: HistoryMessage, roomId: string): ChatMessage => ({
  id: m.id,
  roomId,
  userId: m.user_id,
  username: m.username,
  content: m.content,
  createdAt: m.created_at,
});

export const fromEvent = (e: OutboundEvent): ChatMessage => ({
  id: e.id,
  roomId: e.room_id,
  userId: e.user_id,
  username: e.username ?? "?",
  content: e.content ?? "",
  createdAt: e.created_at,
});

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_USERNAME_LENGTH = 50;
export const MIN_PASSWORD_LENGTH = 6;
