import { updateMessage } from "@/lib/vozzera/api";
import { initials } from "@/lib/vozzera/avatar";
import { useAuth } from "@/lib/vozzera/useAuth";
import { memo, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/lib/vozzera/types";
import { Check, MoreHorizontal, Pen, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/vozzera/Markdown";

function time(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageActions({
  isOwnMessage,
  onEdit,
  onDelete,
}: Readonly<{
  isOwnMessage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  return (
    <>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="group/action h-11 w-11 text-muted-foreground/70 hover:bg-transparent"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md group-hover/action:bg-muted">
                <MoreHorizontal className="h-4 w-4" />
              </span>
              <span className="sr-only">Ações da mensagem</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwnMessage && (
              <DropdownMenuItem onClick={onEdit}>
                <Pen className="h-4 w-4" />
                Editar mensagem
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Excluir mensagem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 gap-1 opacity-0 transition-opacity md:flex md:group-hover:opacity-100 md:focus-within:opacity-100">
        {isOwnMessage && (
          <Button
            variant="secondary"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground [&_svg]:size-4"
            onClick={onEdit}
          >
            <Pen />
            <span className="sr-only">Editar mensagem</span>
          </Button>
        )}
        <Button
          variant="secondary"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive [&_svg]:size-4"
          onClick={onDelete}
        >
          <Trash2 />
          <span className="sr-only">Excluir mensagem</span>
        </Button>
      </div>
    </>
  );
}

export const MessageList = memo(function MessageList({
  messages,
  loading,
  roomId,
  roomName,
  canModerateMessages,
  onDelete,
}: Readonly<{
  messages: ChatMessage[];
  loading: boolean;
  roomId: string;
  roomName: string;
  canModerateMessages: boolean;
  onDelete: (message: ChatMessage) => void;
}>) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const username = useAuth().username;

  useEffect(() => {
    const container = bottomRef.current?.parentElement;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
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

  const startEditing = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const editMessage = async (messageId: string) => {
    const content = editContent.trim();

    if (!content) return;

    try {
      await updateMessage(roomId, messageId, content);

      setEditingMessageId(null);
      setEditContent("");
    } catch (error) {
      console.error("Erro ao editar mensagem:", error);
    }
  };

  return (
    <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-4 sm:px-4">
      <ol className="space-y-0.5">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const grouped = previous?.userId === message.userId;
          const isEditing = editingMessageId === message.id;
          const isOwnMessage = username === message.username;
          const canDeleteMessage = isOwnMessage || canModerateMessages;

          return (
            <li
              key={message.id}
              className={`${grouped ? "" : "pt-3"} ${index < messages.length - 1 ? "[content-visibility:auto] [contain-intrinsic-size:auto_4rem]" : ""}`}
            >
              <div className="group flex gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40 sm:gap-3 sm:px-2">
                <div className="w-9 shrink-0">
                  {!grouped && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-foreground">
                      {initials(message.username)}
                    </div>
                  )}
                </div>

                <div className="relative min-w-0 flex-1">
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

                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        id={`message-edit-${message.id}`}
                        type="text"
                        value={editContent}
                        autoComplete="off"
                        onChange={(event) => setEditContent(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void editMessage(message.id);
                          }

                          if (event.key === "Escape") {
                            cancelEditing();
                          }
                        }}
                      />

                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 p-0 text-primary [&_svg]:size-4"
                          onClick={() => void editMessage(message.id)}
                        >
                          <Check />
                          <span className="sr-only">Salvar edição</span>
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 w-8 p-0 text-muted-foreground [&_svg]:size-4"
                          onClick={cancelEditing}
                        >
                          <X />
                          <span className="sr-only">Cancelar edição</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative text-sm leading-relaxed text-foreground/90 ${canDeleteMessage ? "pr-12 md:pr-0" : ""}`}
                    >
                      <Markdown content={message.content} />
                      {canDeleteMessage && (
                        <MessageActions
                          isOwnMessage={isOwnMessage}
                          onEdit={() => startEditing(message)}
                          onDelete={() => setDeleteTarget(message)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div ref={bottomRef} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A mensagem some para todos na sala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && onDelete(deleteTarget)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
