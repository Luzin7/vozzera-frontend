import { afterEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, wsUrl } from "./api";

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
