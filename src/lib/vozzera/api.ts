import type { HistoryMessage, LoginResponse, RegisterResponse, Room } from "./types";

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

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
  });

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

export const login = (username: string, password: string) =>
  api<LoginResponse>("/api/login", jsonBody({ username, password }));

export const register = (username: string, password: string, inviteCode: string) =>
  api<RegisterResponse>("/api/register", jsonBody({ username, password, invite_code: inviteCode }));

export const listRooms = () => api<Room[]>("/api/rooms");

export const createRoom = (name: string, type: "text" | "voice") =>
  api<Room>("/api/rooms", jsonBody({ name, type }));

export const deleteRoom = (roomId: string) =>
  api(`/api/rooms/${roomId}`, {
    method: "DELETE",
  });

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

export function wsUrl(): string {
  if (typeof window === "undefined") return "";
  const base = API_BASE || window.location.origin;
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}
