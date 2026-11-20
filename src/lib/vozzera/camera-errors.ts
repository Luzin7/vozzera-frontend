export type CameraErrorKind = "denied" | "no-device" | "busy" | "unsupported" | "publish-failed";

export const CAMERA_UNSUPPORTED_TEXT = "Texto pendente para câmera não suportada.";

const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  denied: "Permita o acesso à câmera no navegador para aparecer no vídeo.",
  "no-device": "Nenhuma câmera encontrada neste dispositivo.",
  busy: "Outra aba ou aplicativo está usando a câmera.",
  unsupported: CAMERA_UNSUPPORTED_TEXT,
  "publish-failed": "Não consegui publicar sua câmera. Tente de novo.",
};

export function cameraErrorMessageFor(kind: CameraErrorKind): string {
  return CAMERA_ERROR_MESSAGES[kind];
}
