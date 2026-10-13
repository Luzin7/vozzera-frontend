import { DisconnectReason } from "livekit-client";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/vozzera/api";
import {
  MicrophoneUnavailableError,
  microphoneErrorMessageFor,
  microphoneToggleErrorMessageFor,
  voiceDisconnectMessageFor,
  voiceJoinErrorMessageFor,
} from "@/lib/vozzera/voice-errors";

function domException(name: string): DOMException {
  return new DOMException("", name);
}

describe("microphoneErrorMessageFor", () => {
  it("explains a blocked microphone permission", () => {
    expect(microphoneErrorMessageFor(domException("NotAllowedError"))).toContain(
      "bloqueou o microfone",
    );
  });

  it("reports a missing microphone", () => {
    expect(microphoneErrorMessageFor(domException("NotFoundError"))).toContain("Nenhum microfone");
  });

  it("reports a microphone held by another app", () => {
    expect(microphoneErrorMessageFor(domException("NotReadableError"))).toContain("Feche o app");
  });

  it("reports a selected microphone that is gone", () => {
    expect(microphoneErrorMessageFor(domException("OverconstrainedError"))).toContain(
      "não está mais disponível",
    );
  });

  it("leaves other failures to the caller", () => {
    expect(microphoneErrorMessageFor(new Error("could not establish signal connection"))).toBe(
      null,
    );
  });
});

describe("voiceDisconnectMessageFor", () => {
  it("stays silent when the user left on purpose", () => {
    expect(voiceDisconnectMessageFor(DisconnectReason.CLIENT_INITIATED)).toBe(null);
  });

  it("explains a session taken over by another tab", () => {
    expect(voiceDisconnectMessageFor(DisconnectReason.DUPLICATE_IDENTITY)).toContain("outra aba");
  });

  it("explains a removal from the call", () => {
    expect(voiceDisconnectMessageFor(DisconnectReason.PARTICIPANT_REMOVED)).toContain("removido");
  });

  it("explains a closed channel", () => {
    expect(voiceDisconnectMessageFor(DisconnectReason.ROOM_DELETED)).toContain("encerrado");
    expect(voiceDisconnectMessageFor(DisconnectReason.ROOM_CLOSED)).toContain("encerrado");
  });

  it("reports any other drop as a lost connection", () => {
    expect(voiceDisconnectMessageFor(undefined)).toContain("caiu");
    expect(voiceDisconnectMessageFor(DisconnectReason.SIGNAL_CLOSE)).toContain("caiu");
  });
});

describe("voiceJoinErrorMessageFor", () => {
  it("translates microphone failures", () => {
    expect(voiceJoinErrorMessageFor(domException("NotAllowedError"))).toContain(
      "bloqueou o microfone",
    );
  });

  it("keeps the server message", () => {
    expect(voiceJoinErrorMessageFor(new ApiError(404, "Sala não encontrada"))).toBe(
      "Sala não encontrada",
    );
  });

  it("explains a microphone that could not be prepared", () => {
    expect(voiceJoinErrorMessageFor(new MicrophoneUnavailableError())).toBe(
      "Não consegui preparar o microfone.",
    );
  });

  it("hides internal connection errors behind a generic message", () => {
    expect(voiceJoinErrorMessageFor(new Error("could not establish signal connection"))).toBe(
      "Não consegui entrar no canal.",
    );
  });
});

describe("microphoneToggleErrorMessageFor", () => {
  it("translates microphone failures", () => {
    expect(microphoneToggleErrorMessageFor(domException("NotAllowedError"))).toContain(
      "bloqueou o microfone",
    );
  });

  it("falls back to a generic message", () => {
    expect(microphoneToggleErrorMessageFor(new Error("track ended"))).toBe(
      "Não consegui alterar o microfone.",
    );
  });
});
