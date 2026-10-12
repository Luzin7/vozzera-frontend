import { DisconnectReason } from "livekit-client";

import { ApiError } from "@/lib/vozzera/api";

const MICROPHONE_MESSAGES: Readonly<Record<string, string>> = {
  NotAllowedError:
    "O navegador bloqueou o microfone. Libere o acesso nas permissões do site e tente de novo.",
  NotFoundError: "Nenhum microfone encontrado. Conecte um e tente de novo.",
  NotReadableError:
    "Não consegui usar o microfone. Feche o app que está usando ele e tente de novo.",
  OverconstrainedError:
    "O microfone escolhido não está mais disponível. Escolha outro nas configurações de voz.",
};

const JOIN_FAILED_MESSAGE = "Não consegui entrar no canal.";
const CHANNEL_CLOSED_MESSAGE = "O canal de voz foi encerrado.";
const CONNECTION_LOST_MESSAGE = "A conexão de voz caiu. Entre no canal de novo.";

const DISCONNECT_MESSAGES: ReadonlyMap<DisconnectReason, string | null> = new Map([
  [DisconnectReason.CLIENT_INITIATED, null],
  [DisconnectReason.DUPLICATE_IDENTITY, "Você entrou nesse canal em outra aba ou dispositivo."],
  [DisconnectReason.PARTICIPANT_REMOVED, "Você foi removido do canal de voz."],
  [DisconnectReason.ROOM_DELETED, CHANNEL_CLOSED_MESSAGE],
  [DisconnectReason.ROOM_CLOSED, CHANNEL_CLOSED_MESSAGE],
]);

export function microphoneProblemFor(error: unknown): string | null {
  if (!(error instanceof DOMException)) return null;
  return MICROPHONE_MESSAGES[error.name] ?? null;
}

export function voiceDisconnectMessageFor(reason: DisconnectReason | undefined): string | null {
  if (reason === undefined) return CONNECTION_LOST_MESSAGE;
  const message = DISCONNECT_MESSAGES.get(reason);
  if (message === undefined) return CONNECTION_LOST_MESSAGE;
  return message;
}

export function voiceJoinErrorMessageFor(error: unknown): string {
  const microphoneProblem = microphoneProblemFor(error);
  if (microphoneProblem) return microphoneProblem;
  if (error instanceof ApiError) return error.message;
  return JOIN_FAILED_MESSAGE;
}
