import { SendHorizonal } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { shouldShowCharCounter, shouldShowSendHint } from "@/lib/vozzera/composer-hints";
import type { DraftStore } from "@/lib/vozzera/message-display";
import { MAX_MESSAGE_LENGTH } from "@/lib/vozzera/types";

export const MessageComposer = memo(function MessageComposer({
  roomId,
  roomName,
  drafts,
  disabled,
  onSend,
  onTypingChange,
  onEditLast,
}: Readonly<{
  roomId: string;
  roomName: string;
  drafts: DraftStore;
  disabled: boolean;
  onSend: (content: string) => void;
  onTypingChange: (typing: boolean) => void;
  onEditLast?: () => void;
}>) {
  const [value, setValue] = useState(() => drafts.get(roomId));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();
  const canSend = !disabled && trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;

  useEffect(() => {
    onTypingChange(false);
    inputRef.current?.focus();
  }, [roomId, onTypingChange]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    onTypingChange(false);
    drafts.clear(roomId);
    setValue("");
  };

  return (
    <div className="w-full border-t border-border bg-background px-2 py-1.5 sm:px-4 sm:py-2">
      <div className="flex min-h-11 min-w-0 items-end gap-2 rounded-lg border border-input bg-card px-2 py-1">
        <Textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            drafts.set(roomId, e.target.value);
            onTypingChange(e.target.value.length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
              return;
            }

            if (e.key === "ArrowUp" && value === "" && onEditLast) {
              e.preventDefault();
              onEditLast();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={disabled ? "Conexão perdida..." : `Mensagem em #${roomName}`}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-3 leading-5 shadow-none focus-visible:ring-0"
        />
        <Button size="icon" className="h-11 w-11 shrink-0" disabled={!canSend} onClick={submit}>
          <SendHorizonal className="h-4 w-4" />
          <span className="sr-only">Enviar</span>
        </Button>
      </div>
      <p className="mt-1 flex min-h-4 justify-between gap-2 px-1 text-[11px] text-muted-foreground">
        <span>
          {shouldShowSendHint({ focused, empty: trimmed.length === 0 }) &&
            "Enter envia, Shift+Enter quebra linha"}
        </span>
        {shouldShowCharCounter(trimmed.length, MAX_MESSAGE_LENGTH) && (
          <span className="tabular-nums">
            {trimmed.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </p>
    </div>
  );
});
