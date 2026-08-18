import { ApiError } from "@/lib/vozzera/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/vozzera/types";

type AuthMode = "login" | "register" | "forgot" | "reset" | "email";

const MODES_WITH_EMAIL_INVALID: ReadonlySet<AuthMode> = new Set(["register", "forgot", "email"]);

const STATUS_MESSAGES: Record<number, string> = {
  403: "Código de convite inválido.",
  401: "Usuário ou senha incorretos.",
};

function conflictMessageFor(mode: AuthMode): string {
  if (mode === "email") return "Esse email já está em uso.";
  return "Esse nome de usuário já está em uso.";
}

function statusMessageFor(status: number, mode: AuthMode): string | null {
  if (status === 409) return conflictMessageFor(mode);
  return STATUS_MESSAGES[status] ?? null;
}

function invalidEmailMessageFor(err: ApiError, mode: AuthMode): string | null {
  if (!MODES_WITH_EMAIL_INVALID.has(mode)) return null;
  if (!err.message.toLowerCase().includes("email")) return null;
  return "Email inválido.";
}

function resetValidationMessageFor(err: ApiError): string | null {
  const message = err.message.toLowerCase();
  if (message.includes("token")) return "Token inválido ou expirado.";
  if (message.includes("senha"))
    return `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return null;
}

export function authErrorMessageFor(err: unknown, mode: AuthMode = "login"): string {
  if (!(err instanceof ApiError)) return "Servidor indisponível. Ele está rodando?";
  if (err.status === 400 && mode === "reset") return resetValidationMessageFor(err) ?? err.message;
  if (err.status === 400) return invalidEmailMessageFor(err, mode) ?? err.message;
  return statusMessageFor(err.status, mode) ?? (err.message || "Não foi possível concluir.");
}
