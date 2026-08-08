import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/vozzera/types";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function time(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({
  messages,
  loading,
  roomName,
}: {
  messages: ChatMessage[];
  loading: boolean;
  roomName: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Carregando histórico...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Silêncio absoluto em #{roomName}</p>
          <p className="mt-1 text-sm text-muted-foreground">Manda a primeira mensagem.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <ol className="space-y-0.5">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const grouped = previous?.userId === message.userId;

          return (
            <li key={message.id} className={grouped ? "" : "pt-3"}>
              <div className="flex gap-3 rounded-md px-2 py-0.5 hover:bg-muted/40">
                <div className="w-9 shrink-0">
                  {!grouped && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-foreground">
                      {initials(message.username)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {message.username}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {time(message.createdAt)}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                    {message.content}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={bottomRef} />
    </div>
  );
}
