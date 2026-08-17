import { ApiError } from "@/lib/vozzera/api";

export function authErrorMessageFor(err: unknown, mode: "login" | "register" = "login"): string {
  if (
    err instanceof ApiError &&
    err.status === 400 &&
    mode === "register" &&
    err.message.toLowerCase().includes("email")
  )
    return "Email inválido.";
  if (err instanceof ApiError && err.status === 403) return "Código de convite inválido.";
  if (err instanceof ApiError && err.status === 409) return "Esse nome de usuário já está em uso.";
  if (err instanceof ApiError && err.status === 401) return "Usuário ou senha incorretos.";
  if (err instanceof ApiError) return err.message || "Não foi possível concluir.";
  return "Servidor indisponível. Ele está rodando?";
}
