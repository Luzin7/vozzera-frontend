import { useCallback, useEffect, useState } from "react";

type DocumentPictureInPicture = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
};

type MiniWindowOptions = {
  active: boolean;
  onError: (message: string) => void;
};

const MINI_WINDOW_SIZE = { width: 320, height: 380 };
const OPEN_FAILED_MESSAGE = "Não consegui abrir a mini janela.";

function documentPictureInPicture(): DocumentPictureInPicture | null {
  return (
    (window as Window & { documentPictureInPicture?: DocumentPictureInPicture })
      .documentPictureInPicture ?? null
  );
}

function copyStylesheets(target: Document): void {
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode;
    if (owner instanceof HTMLLinkElement || owner instanceof HTMLStyleElement) {
      target.head.appendChild(owner.cloneNode(true));
    }
  }
}

export function useVoiceMiniWindow({ active, onError }: MiniWindowOptions): {
  supported: boolean;
  isOpen: boolean;
  container: HTMLElement | null;
  toggle: () => void;
} {
  const [supported, setSupported] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSupported(documentPictureInPicture() !== null);
  }, []);

  const close = useCallback(() => {
    container?.ownerDocument.defaultView?.close();
    setContainer(null);
  }, [container]);

  const open = useCallback(async () => {
    const api = documentPictureInPicture();
    if (!api) return;

    const miniWindow = await api.requestWindow(MINI_WINDOW_SIZE).catch(() => null);
    if (!miniWindow) {
      onError(OPEN_FAILED_MESSAGE);
      return;
    }

    copyStylesheets(miniWindow.document);
    miniWindow.document.title = "Vozzera";
    miniWindow.addEventListener("pagehide", () => setContainer(null), { once: true });
    setContainer(miniWindow.document.body);
  }, [onError]);

  const toggle = useCallback(() => {
    if (container) {
      close();
      return;
    }
    void open();
  }, [container, close, open]);

  useEffect(() => {
    if (active) return;
    close();
  }, [active, close]);

  useEffect(() => () => container?.ownerDocument.defaultView?.close(), [container]);

  return { supported, isOpen: container !== null, container, toggle };
}
