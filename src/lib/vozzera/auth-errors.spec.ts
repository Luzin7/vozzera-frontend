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
    expect(authErrorMessageFor(new ApiError(400, "Email inválido"), "forgot")).toBe(
      "Email inválido.",
    );
    expect(authErrorMessageFor(new ApiError(400, "Email inválido"), "email")).toBe(
      "Email inválido.",
    );
    expect(authErrorMessageFor(new ApiError(409, "x"), "email")).toBe("Esse email já está em uso.");
    expect(authErrorMessageFor(new ApiError(400, "Token inválido ou expirado"), "reset")).toBe(
      "Token inválido ou expirado.",
    );
    expect(
      authErrorMessageFor(new ApiError(400, "Senha deve ter entre 8 e 72 caracteres"), "reset"),
    ).toBe("Senha deve ter pelo menos 8 caracteres.");
  });

  it("falls back to the api message for other ApiErrors", () => {
    expect(authErrorMessageFor(new ApiError(500, "Erro interno."))).toBe("Erro interno.");
    expect(authErrorMessageFor(new ApiError(400, "Payload inválido."))).toBe("Payload inválido.");
    expect(authErrorMessageFor(new ApiError(400, "Senha inválida"), "register")).toBe(
      "Senha inválida",
    );
  });

  it("falls back to the server-down message for anything else", () => {
    expect(authErrorMessageFor(new Error("boom"))).toBe(
      "Não consegui conectar ao servidor. Verifique sua conexão e tente de novo.",
    );
  });
});
