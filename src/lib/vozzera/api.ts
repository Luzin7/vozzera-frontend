import { resolveApiBaseUrl } from "@/lib/vozzera/api-url";
import type {
  CurrentUser,
  HistoryMessage,
  LoginResponse,
  PresenceSnapshot,
  RegisterRequest,
  RegisterResponse,
  Room,
  UpdateEmailResponse,
} from "@/lib/vozzera/types";

export const API_BASE: string = resolveApiBaseUrl({
  isProduction: import.meta.env.PROD,
  value: import.meta.env["VITE_API_URL"] as string | undefined,
});

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message || `Erro ${status}`);
    this.status = status;
    this.name = "ApiError";
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function request(path: string, opts: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
  });

  if (res.status === 401) {
    onUnauthorized?.();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text.trim());
  }

  return res;
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await request(path, opts);

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function jsonBody(data: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function jsonRequest(method: "POST" | "PATCH", data: unknown): RequestInit {
  return { ...jsonBody(data), method };
}

export const login = (username: string, password: string) =>
  api<LoginResponse>("/api/login", jsonBody({ username, password }));

export const register = ({ username, password, email, inviteCode }: RegisterRequest) =>
  api<RegisterResponse>(
    "/api/register",
    jsonBody({ username, password, email, invite_code: inviteCode }),
  );

export const requestPasswordReset = (email: string) =>
  api("/api/forgot-password", jsonBody({ email }));

export const resetPassword = (token: string, password: string) =>
  api("/api/reset-password", jsonBody({ token, password }));

export const logout = () => api<void>("/api/logout", { method: "POST" });

export const listRooms = () => api<Room[]>("/api/rooms");

export const getCurrentUser = () => api<CurrentUser>("/api/me");

const SESSION_PROBE_TIMEOUT_MS = 5000;

export const probeCurrentUser = () =>
  api<CurrentUser>("/api/me", { signal: AbortSignal.timeout(SESSION_PROBE_TIMEOUT_MS) });

export const updateEmail = (email: string) =>
  api<UpdateEmailResponse>("/api/me", jsonRequest("PATCH", { email }));

type CreateRoomInput = { name: string; hasVoice: boolean; staffOnly: boolean };

export const createRoom = ({ name, hasVoice, staffOnly }: CreateRoomInput) =>
  api<Room>("/api/rooms", jsonBody({ name, has_voice: hasVoice, staff_only: staffOnly }));

type UpdateRoomInput = { name: string; staffOnly?: boolean };

function updateRoomBody({ name, staffOnly }: UpdateRoomInput): Record<string, unknown> {
  if (staffOnly === undefined) return { name };
  return { name, staff_only: staffOnly };
}

export const updateRoom = (roomId: string, input: UpdateRoomInput) =>
  api<Room>(`/api/rooms/${roomId}`, jsonRequest("PATCH", updateRoomBody(input)));

export const deleteRoom = (roomId: string) =>
  api<void>(`/api/rooms/${roomId}`, { method: "DELETE" });

const HISTORY_FETCH_TIMEOUT_MS = 10_000;

export type MessagesPage = { messages: HistoryMessage[]; nextBefore: string | null };

export function parseNextBefore(headers: Headers): string | null {
  const cursor = headers.get("X-Next-Before")?.trim();
  return cursor || null;
}

export async function listMessages(
  roomId: string,
  limit = 50,
  before?: string,
): Promise<MessagesPage> {
  const cursor = before ? `&before=${encodeURIComponent(before)}` : "";
  const res = await request(`/api/rooms/${roomId}/messages?limit=${limit}${cursor}`, {
    signal: AbortSignal.timeout(HISTORY_FETCH_TIMEOUT_MS),
  });

  return {
    messages: (await res.json()) as HistoryMessage[],
    nextBefore: parseNextBefore(res.headers),
  };
}

export const updateMessage = (roomId: string, messageId: string, content: string) =>
  api<HistoryMessage>(`/api/rooms/${roomId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

export const deleteMessage = (roomId: string, messageId: string) =>
  api(`/api/rooms/${roomId}/messages/${messageId}`, {
    method: "DELETE",
  });

export const getPresence = () => api<PresenceSnapshot>("/api/presence");

export function wsUrl(): string {
  if (typeof window === "undefined") return "";
  const base = API_BASE || window.location.origin;
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/ws";
  url.search = "";
  return url.toString();
}
