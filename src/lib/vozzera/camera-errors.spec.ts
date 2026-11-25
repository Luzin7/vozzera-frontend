import { describe, expect, it } from "vitest";

import {
  CAMERA_SWITCH_TEXT,
  CAMERA_UNSUPPORTED_TEXT,
  cameraErrorMessageFor,
  type CameraErrorKind,
} from "@/lib/vozzera/camera-errors";

describe("cameraErrorMessageFor", () => {
  it("exposes the pending switch label from the issue", () => {
    expect(CAMERA_SWITCH_TEXT).toBe("Trocar câmera");
  });

  it.each<[CameraErrorKind, string]>([
    ["denied", "Permita o acesso à câmera no navegador para aparecer no vídeo."],
    ["no-device", "Nenhuma câmera encontrada neste dispositivo."],
    ["busy", "Outra aba ou aplicativo está usando a câmera."],
    ["unsupported", CAMERA_UNSUPPORTED_TEXT],
    ["publish-failed", "Não consegui publicar sua câmera. Tente de novo."],
  ])("maps %s to its pt-BR message", (kind, message) => {
    expect(cameraErrorMessageFor(kind)).toBe(message);
  });
});
