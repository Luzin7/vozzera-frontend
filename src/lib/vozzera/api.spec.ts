import { afterEach, describe, expect, it, vi } from "vitest";

import {
  api,
  ApiError,
  deleteRoom,
  getCurrentUser,
  register,
  updateRoom,
  wsUrl,
} from "@/lib/vozzera/api";

type WindowLike = { window?: { location: { origin: string } } };

describe("ApiError", () => {
  it("carries status, message and name", () => {
    const error = new ApiError(403, "Código de convite inválido.");
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Código de convite inválido.");
    expect(error.name).toBe("ApiError");
  });

  it("falls back to a default message", () => {
    expect(new ApiError(500, "").message).toBe("Erro 500");
  });
});

describe("api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends credentials and returns parsed json on 2xx", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "r1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api<{ id: string }>("/api/rooms")).resolves.toEqual({ id: "r1" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("throws ApiError with the text body on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Usuário ou senha incorretos.", { status: 401 })),
    );

    await expect(api("/api/login")).rejects.toMatchObject({
      status: 401,
      message: "Usuário ou senha incorretos.",
    });
  });

  it("returns undefined on 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    await expect(api("/api/rooms/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("register", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the required email in the request body", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ message: "ok", id: "u1" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await register({
      username: "brian",
      password: "password",
      email: "brian@example.com",
      inviteCode: "convite",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/register"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "brian",
          password: "password",
          email: "brian@example.com",
          invite_code: "convite",
        }),
      }),
    );
  });
});

describe("room management", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the current user role", async () => {
    const currentUser = { id: "u1", username: "luan", role: "mod" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(currentUser), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).resolves.toEqual(currentUser);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/me"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("renames and deletes rooms with the expected methods", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "r1", name: "novo", type: "text", created_at: "" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateRoom("r1", "novo");
    await deleteRoom("r1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/rooms/r1"),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "novo" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/rooms/r1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("wsUrl", () => {
  afterEach(() => {
    delete (globalThis as WindowLike).window;
  });

  it("returns empty when window is unavailable", () => {
    expect(wsUrl()).toBe("");
  });

  it("derives ws:// from the api base", () => {
    (globalThis as WindowLike).window = { location: { origin: "http://example.com" } };
    expect(wsUrl()).toBe("ws://localhost:8080/ws");
  });
});
