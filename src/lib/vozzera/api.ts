import type {
  CurrentUser,
  HistoryMessage,
  LoginResponse,
  RegisterResponse,
  Room,
} from "@/lib/vozzera/types";

export const API_BASE: string =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message || `Erro ${status}`);
    this.status = status;
    this.name = "ApiError";
  }
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
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

export const register = (username: string, password: string, email: string, inviteCode: string) =>
  api<RegisterResponse>(
    "/api/register",
    jsonBody({ username, password, email, invite_code: inviteCode }),
  );

export const logout = () => api<void>("/api/logout", { method: "POST" });

export const listRooms = () => api<Room[]>("/api/rooms");

export const getCurrentUser = () => api<CurrentUser>("/api/me");

export const createRoom = (name: string, type: "text" | "voice") =>
  api<Room>("/api/rooms", jsonBody({ name, type }));

export const updateRoom = (roomId: string, name: string) =>
  api<Room>(`/api/rooms/${roomId}`, jsonRequest("PATCH", { name }));

export const deleteRoom = (roomId: string) =>
  api<void>(`/api/rooms/${roomId}`, { method: "DELETE" });

export const listMessages = (roomId: string, limit = 50) =>
  api<HistoryMessage[]>(`/api/rooms/${roomId}/messages?limit=${limit}`);

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

export function wsUrl(): string {
  if (typeof window === "undefined") return "";
  const base = API_BASE || window.location.origin;
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}
