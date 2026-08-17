import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/vozzera/api";
import { authErrorMessageFor } from "@/lib/vozzera/auth-errors";

describe("authErrorMessageFor", () => {
  it("translates known statuses to pt-BR messages", () => {
    expect(authErrorMessageFor(new ApiError(403, "x"))).toBe("Código de convite inválido.");
    expect(authErrorMessageFor(new ApiError(409, "x"))).toBe(
      "Esse nome de usuário já está em uso.",
    );
    expect(authErrorMessageFor(new ApiError(401, "x"))).toBe("Usuário ou senha incorretos.");
    expect(authErrorMessageFor(new ApiError(400, "Email inválido"), "register")).toBe(
      "Email inválido.",
    );
  });

  it("falls back to the api message for other ApiErrors", () => {
    expect(authErrorMessageFor(new ApiError(500, "Erro interno."))).toBe("Erro interno.");
    expect(authErrorMessageFor(new ApiError(400, "Payload inválido."))).toBe("Payload inválido.");
    expect(authErrorMessageFor(new ApiError(400, "Senha inválida"), "register")).toBe(
      "Senha inválida",
    );
  });

  it("falls back to the server-down message for anything else", () => {
    expect(authErrorMessageFor(new Error("boom"))).toBe("Servidor indisponível. Ele está rodando?");
  });
});
