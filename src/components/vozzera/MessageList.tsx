import { updateMessage } from "@/lib/vozzera/api";
import { dateGroupLabelFor } from "@/lib/vozzera/chat";
import { useAuth } from "@/lib/vozzera/useAuth";
import { Fragment, memo, useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/lib/vozzera/types";
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
import { MessageItem } from "@/components/vozzera/MessageItem";
import { Skeleton } from "@/components/ui/skeleton";

export const MessageList = memo(function MessageList({
  messages,
  loading,
  roomId,
  roomName,
  typingText,
  canModerateMessages,
  onDelete,
  onRoomClick,
}: Readonly<{
  messages: ChatMessage[];
  loading: boolean;
  roomId: string;
  roomName: string;
  typingText: string | null;
  canModerateMessages: boolean;
  onDelete: (message: ChatMessage) => void;
  onRoomClick: ((roomName: string) => void) | undefined;
}>) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const editContentRef = useRef(editContent);
  const username = useAuth().username;

  editContentRef.current = editContent;

  const jumpToLatest = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
    setShowJumpToLatest(false);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance < 80) setShowJumpToLatest(false);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll, loading]);

  useEffect(() => {
    if (loading) return;

    setShowJumpToLatest(false);

    const container = scrollRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [loading, roomId]);

  useEffect(() => {
    if (loading) return;

    const container = scrollRef.current;
    if (!container) return;

    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance > 80) {
      setShowJumpToLatest(true);
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages.length, loading]);

  const startEditing = useCallback((message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
    setEditContent("");
  }, []);

  const handleEditContentChange = useCallback((content: string) => {
    setEditContent(content);
  }, []);

  const editMessage = useCallback(
    async (messageId: string) => {
      const content = editContentRef.current.trim();

      if (!content) return;

      try {
        await updateMessage(roomId, messageId, content);

        setEditingMessageId(null);
        setEditContent("");
      } catch (error) {
        console.error("Erro ao editar mensagem:", error);
      }
    },
    [roomId],
  );

  const handleSaveEdit = useCallback(
    (messageId: string) => {
      void editMessage(messageId);
    },
    [editMessage],
  );

  if (loading) {
    return (
      <div className="min-w-0 flex-1 overflow-hidden px-2 py-4 sm:px-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="mb-4 flex gap-2 px-1 sm:gap-3 sm:px-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">Silêncio absoluto em #{roomName}</p>
            <p className="mt-1 text-sm text-muted-foreground">Manda a primeira mensagem.</p>
          </div>
        </div>
        {typingText && (
          <p className="px-4 pb-2 text-xs text-muted-foreground" aria-live="polite">
            {typingText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-4 sm:px-4"
      >
        <ol className="space-y-0.5">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const dateLabel = dateGroupLabelFor(message.createdAt);
            const previousDateLabel = previous ? dateGroupLabelFor(previous.createdAt) : null;
            const startsDateGroup = dateLabel !== previousDateLabel;
            const grouped = !startsDateGroup && previous?.userId === message.userId;
            const isEditing = editingMessageId === message.id;
            const isOwnMessage = username === message.username;
            const canDeleteMessage = isOwnMessage || canModerateMessages;

            return (
              <Fragment key={message.id}>
                {startsDateGroup && dateLabel && (
                  <li
                    role="separator"
                    aria-label={dateLabel}
                    className="flex items-center gap-3 py-4 text-xs text-muted-foreground"
                  >
                    <span className="h-px flex-1 bg-border" />
                    <span>{dateLabel}</span>
                    <span className="h-px flex-1 bg-border" />
                  </li>
                )}
                <MessageItem
                  message={message}
                  grouped={grouped}
                  isLast={index === messages.length - 1}
                  isOwnMessage={isOwnMessage}
                  canDeleteMessage={canDeleteMessage}
                  isEditing={isEditing}
                  editContent={isEditing ? editContent : ""}
                  onStartEdit={startEditing}
                  onRequestDelete={setDeleteTarget}
                  onEditContentChange={handleEditContentChange}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={cancelEditing}
                  onRoomClick={onRoomClick}
                />
              </Fragment>
            );
          })}
        </ol>
      </div>

      {showJumpToLatest && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md"
        >
          Ir para a última mensagem
        </button>
      )}

      {typingText && (
        <p className="px-4 pb-2 text-xs text-muted-foreground" aria-live="polite">
          {typingText}
        </p>
      )}

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
