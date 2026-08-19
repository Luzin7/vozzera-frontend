import { SendHorizonal } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_LENGTH } from "@/lib/vozzera/types";

export const MessageComposer = memo(function MessageComposer({
  roomId,
  roomName,
  disabled,
  onSend,
}: Readonly<{
  roomId: string;
  roomName: string;
  disabled: boolean;
  onSend: (content: string) => void;
}>) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();
  const canSend = !disabled && trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;

  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="flex items-end gap-2 rounded-lg border border-input bg-card px-3 py-2">
        <Textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={disabled ? "Conexão perdida..." : `Mensagem em #${roomName}`}
          className="max-h-40 min-h-0 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" disabled={!canSend} onClick={submit}>
          <SendHorizonal className="h-4 w-4" />
          <span className="sr-only">Enviar</span>
        </Button>
      </div>
      <p className="mt-1 px-1 text-[11px] text-muted-foreground">
        Enter envia, Shift+Enter quebra linha · {trimmed.length}/{MAX_MESSAGE_LENGTH}
      </p>
    </div>
  );
});
