import { useEffect, useRef } from "react";

import { voiceShortcutFor } from "./voice-shortcuts";

type Props = {
  enabled: boolean;
  miniWindowContainer: HTMLElement | null;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
};

function typingDetailsFor(target: EventTarget | null) {
  const element = target as Partial<HTMLElement> | null;
  return {
    tagName: typeof element?.tagName === "string" ? element.tagName : undefined,
    contentEditable: element?.isContentEditable === true,
  };
}

export function useVoiceShortcuts({
  enabled,
  miniWindowContainer,
  onToggleMic,
  onToggleDeafen,
}: Props) {
  const actionsRef = useRef({ onToggleMic, onToggleDeafen });
  actionsRef.current = { onToggleMic, onToggleDeafen };

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = voiceShortcutFor({
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        ...typingDetailsFor(event.target),
      });
      if (action === null) return;
      event.preventDefault();
      if (action === "toggle-mic") actionsRef.current.onToggleMic();
      else actionsRef.current.onToggleDeafen();
    };

    const targets: Window[] = [window];
    const miniWindow = miniWindowContainer?.ownerDocument.defaultView;
    if (miniWindow) targets.push(miniWindow);
    for (const target of targets) target.addEventListener("keydown", handleKeyDown);
    return () => {
      for (const target of targets) target.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, miniWindowContainer]);
}
