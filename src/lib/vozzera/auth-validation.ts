import { ApiError } from "@/lib/vozzera/api";
import { authErrorMessageFor, type AuthFormError } from "@/lib/vozzera/auth-errors";
import type { LoginResponse, RegisterRequest } from "@/lib/vozzera/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGACY_EMAIL_SUFFIX = "@legacy.local";

export const CREATED_ACCOUNT_NOTICE = "Conta criada, entre agora.";

type AuthGateway = {
  register: (input: RegisterRequest) => Promise<unknown>;
  login: (username: string, password: string) => Promise<LoginResponse>;
};

type LoginAttempt = { ok: true; username: string } | { ok: false; error: unknown };

function isRejectedLogin(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export type AuthSubmissionResult =
  | { status: "authenticated"; username: string }
  | { status: "registered"; notice: string }
  | { status: "failed"; message: string };

export function registrationEmailErrorFor(email: string): string | null {
  const clean = email.trim();
  if (!clean) return "Informe seu email.";
  if (!EMAIL_PATTERN.test(clean)) return "Informe um email válido.";
  return null;
}

export function requiresEmailSetup(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith(LEGACY_EMAIL_SUFFIX);
}

export function passwordConfirmationErrorFor(
  password: string,
  confirmation: string,
): AuthFormError | null {
  if (password === confirmation) return null;
  return "passwordMismatch";
}

export type AuthModeDraft = {
  mode: "login" | "register" | "forgot";
  error: string | null;
  registeredNotice: string | null;
  confirmation: string;
};

export function switchAuthMode(draft: AuthModeDraft, mode: AuthModeDraft["mode"]): AuthModeDraft {
  return { ...draft, mode, error: null, registeredNotice: null, confirmation: "" };
}

async function attemptLogin(input: RegisterRequest, gateway: AuthGateway): Promise<LoginAttempt> {
  try {
    const session = await gateway.login(input.username, input.password);
    return { ok: true, username: session.username };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function submitAuthCredentials(
  mode: "login" | "register",
  input: RegisterRequest,
  gateway: AuthGateway,
): Promise<AuthSubmissionResult> {
  if (mode === "register") {
    try {
      await gateway.register(input);
    } catch (error) {
      return { status: "failed", message: authErrorMessageFor(error, "register") };
    }
  }

  const attempt = await attemptLogin(input, gateway);
  if (attempt.ok) return { status: "authenticated", username: attempt.username };
  if (mode === "register" && isRejectedLogin(attempt.error))
    return { status: "registered", notice: CREATED_ACCOUNT_NOTICE };
  return { status: "failed", message: authErrorMessageFor(attempt.error, "login") };
}
