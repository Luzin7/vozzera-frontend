import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/vozzera/api";
import { authFormErrorMessageFor } from "@/lib/vozzera/auth-errors";
import {
  CREATED_ACCOUNT_NOTICE,
  passwordConfirmationErrorFor,
  registrationEmailErrorFor,
  requiresEmailSetup,
  submitAuthCredentials,
  switchAuthMode,
} from "@/lib/vozzera/auth-validation";

const credentials = {
  username: "ana",
  password: "segredo123",
  email: "ana@example.com",
  inviteCode: "convite",
};

describe("registrationEmailErrorFor", () => {
  it("accepts a valid email", () => {
    expect(registrationEmailErrorFor("pessoa@example.com")).toBeNull();
  });

  it("rejects an empty email", () => {
    expect(registrationEmailErrorFor("  ")).toBe("Informe seu email.");
  });

  it.each(["sem-arroba", "pessoa@", "@example.com", "pessoa@example"])(
    "rejects the invalid email %s",
    (email) => {
      expect(registrationEmailErrorFor(email)).toBe("Informe um email válido.");
    },
  );
});

describe("requiresEmailSetup", () => {
  it("flags legacy emails", () => {
    expect(requiresEmailSetup("user_abc@legacy.local")).toBe(true);
  });

  it("accepts real emails", () => {
    expect(requiresEmailSetup("pessoa@example.com")).toBe(false);
  });

  it("accepts missing email", () => {
    expect(requiresEmailSetup(null)).toBe(false);
    expect(requiresEmailSetup(undefined)).toBe(false);
  });
});

describe("passwordConfirmationErrorFor", () => {
  it("accepts a matching confirmation", () => {
    expect(passwordConfirmationErrorFor("segredo123", "segredo123")).toBeNull();
  });

  it("rejects a mismatched confirmation", () => {
    expect(passwordConfirmationErrorFor("segredo123", "segredo124")).toBe("passwordMismatch");
  });

  it("maps the mismatch error to pt-BR copy", () => {
    expect(authFormErrorMessageFor("passwordMismatch")).toBe("As senhas não coincidem.");
  });
});

describe("switchAuthMode", () => {
  const draft = {
    mode: "register" as const,
    error: "Erro antigo",
    registeredNotice: CREATED_ACCOUNT_NOTICE,
    confirmation: "segredo123",
  };

  it("clears the confirmation on every mode switch", () => {
    expect(switchAuthMode(draft, "login")).toEqual({
      mode: "login",
      error: null,
      registeredNotice: null,
      confirmation: "",
    });
    expect(switchAuthMode(draft, "register")).toEqual({
      mode: "register",
      error: null,
      registeredNotice: null,
      confirmation: "",
    });
  });
});

describe("submitAuthCredentials", () => {
  const gatewayWith = (registerResult: unknown, loginResult: unknown) => ({
    register: vi.fn().mockResolvedValue(registerResult),
    login: vi.fn().mockResolvedValue(loginResult),
  });

  it("authenticates a login", async () => {
    const gateway = gatewayWith({}, { username: "ana" });

    await expect(submitAuthCredentials("login", credentials, gateway)).resolves.toEqual({
      status: "authenticated",
      username: "ana",
    });
    expect(gateway.register).not.toHaveBeenCalled();
  });

  it("reports a login failure as a login error", async () => {
    const gateway = gatewayWith({}, null);
    gateway.login.mockRejectedValue(new ApiError(401, "x"));

    await expect(submitAuthCredentials("login", credentials, gateway)).resolves.toEqual({
      status: "failed",
      message: "Usuário ou senha incorretos.",
    });
  });

  it("reports a registration failure", async () => {
    const gateway = gatewayWith({}, null);
    gateway.register.mockRejectedValue(new ApiError(409, "x"));

    await expect(submitAuthCredentials("register", credentials, gateway)).resolves.toEqual({
      status: "failed",
      message: "Esse nome de usuário já está em uso.",
    });
    expect(gateway.login).not.toHaveBeenCalled();
  });

  it("reports the created account when auto-login fails", async () => {
    const gateway = gatewayWith({}, null);
    gateway.login.mockRejectedValue(new ApiError(401, "x"));

    await expect(submitAuthCredentials("register", credentials, gateway)).resolves.toEqual({
      status: "registered",
      notice: CREATED_ACCOUNT_NOTICE,
    });
    expect(CREATED_ACCOUNT_NOTICE).toBe("Conta criada, entre agora.");
  });

  it("authenticates right after a successful registration", async () => {
    const gateway = gatewayWith({}, { username: "ana" });

    await expect(submitAuthCredentials("register", credentials, gateway)).resolves.toEqual({
      status: "authenticated",
      username: "ana",
    });
  });

  it("reports a server failure on the auto-login instead of the created-account notice", async () => {
    const gateway = gatewayWith({}, null);
    gateway.login.mockRejectedValue(new ApiError(500, "instável"));

    await expect(submitAuthCredentials("register", credentials, gateway)).resolves.toEqual({
      status: "failed",
      message: "instável",
    });
  });

  it("reports a network failure on the auto-login instead of the created-account notice", async () => {
    const gateway = gatewayWith({}, null);
    gateway.login.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(submitAuthCredentials("register", credentials, gateway)).resolves.toEqual({
      status: "failed",
      message: "Não consegui conectar ao servidor. Verifique sua conexão e tente de novo.",
    });
  });

  it("reports a network failure on the registration itself", async () => {
    const gateway = gatewayWith({}, { username: "ana" });
    gateway.register.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(submitAuthCredentials("register", credentials, gateway)).resolves.toEqual({
      status: "failed",
      message: "Não consegui conectar ao servidor. Verifique sua conexão e tente de novo.",
    });
    expect(gateway.login).not.toHaveBeenCalled();
  });
});
