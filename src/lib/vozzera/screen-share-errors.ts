const MACOS_PERMISSION_MESSAGE =
  "O sistema bloqueou a captura de tela. No macOS, libere o navegador em Ajustes do Sistema › Privacidade e Segurança › Gravação de Tela.";
const UNREADABLE_MESSAGE =
  "Não consegui capturar essa tela. Tente outra janela ou feche o app que está bloqueando a captura.";
const UNSUPPORTED_MESSAGE = "Seu navegador não permite compartilhar a tela neste dispositivo.";
const GENERIC_MESSAGE = "Não consegui começar a transmissão.";

const UNREADABLE_ERROR_NAMES: ReadonlySet<string> = new Set(["NotReadableError", "AbortError"]);

function notAllowedMessageFor(error: DOMException): string | null {
  const message = error.message.toLowerCase();
  if (message.includes("system")) return MACOS_PERMISSION_MESSAGE;
  if (message.includes("denied")) return null;
  return GENERIC_MESSAGE;
}

export function screenShareErrorMessageFor(error: unknown): string | null {
  if (error instanceof TypeError) return UNSUPPORTED_MESSAGE;
  if (!(error instanceof DOMException)) return GENERIC_MESSAGE;
  if (error.name === "NotAllowedError") return notAllowedMessageFor(error);
  if (error.name === "TypeError") return UNSUPPORTED_MESSAGE;
  if (UNREADABLE_ERROR_NAMES.has(error.name)) return UNREADABLE_MESSAGE;
  return GENERIC_MESSAGE;
}
