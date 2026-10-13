import { useCallback, useEffect, useState } from "react";

type DocumentPictureInPicture = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
};

const MINI_WINDOW_SIZE = { width: 320, height: 380 };

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

export function useVoiceMiniWindow(): {
  supported: boolean;
  container: HTMLElement | null;
  open: () => Promise<void>;
  close: () => void;
} {
  const [supported, setSupported] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSupported(documentPictureInPicture() !== null);
  }, []);

  const open = useCallback(async () => {
    const api = documentPictureInPicture();
    if (!api) return;

    const miniWindow = await api.requestWindow(MINI_WINDOW_SIZE).catch(() => null);
    if (!miniWindow) return;

    copyStylesheets(miniWindow.document);
    miniWindow.document.title = "Vozzera";
    miniWindow.document.body.className = "bg-background text-foreground antialiased";
    miniWindow.addEventListener("pagehide", () => setContainer(null), { once: true });
    setContainer(miniWindow.document.body);
  }, []);

  const close = useCallback(() => {
    container?.ownerDocument.defaultView?.close();
    setContainer(null);
  }, [container]);

  return { supported, container, open, close };
}
