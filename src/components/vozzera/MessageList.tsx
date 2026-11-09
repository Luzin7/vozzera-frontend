import { toast } from "sonner";

import { updateMessage } from "@/lib/vozzera/api";
import { anchoredScrollTop, dateGroupLabelFor, isNearBottom, isPrepend } from "@/lib/vozzera/chat";
import { lastOwnMessage, shouldGroupMessages } from "@/lib/vozzera/message-display";
import { useAuth } from "@/lib/vozzera/useAuth";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { OlderHistory } from "@/lib/vozzera/chat-history";
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
import { Button } from "@/components/ui/button";
import { MessageItem } from "@/components/vozzera/MessageItem";
import { Skeleton } from "@/components/ui/skeleton";

function olderStatusText(history: OlderHistory): string {
  if (history.failed) return "Não consegui carregar as mensagens antigas.";
  if (history.loading) return "Carregando mensagens antigas…";
  if (history.nextBefore === null) return "Início da conversa";
  return "";
}

export const MessageList = memo(function MessageList({
  messages,
  loading,
  roomId,
  roomName,
  typingText,
  canModerateMessages,
  onDelete,
  onReply,
  onRoomClick,
  unreadMarkerMessageId,
  onUnreadMarkerRead,
  historyFailed = false,
  onRetryHistory,
  editLastRequest = 0,
  olderHistory,
  onLoadOlder,
  searchQuery = "",
}: Readonly<{
  messages: ChatMessage[];
  loading: boolean;
  roomId: string;
  roomName: string;
  typingText: string | null;
  canModerateMessages: boolean;
  onDelete: (message: ChatMessage) => void;
  onReply?: (message: ChatMessage) => void;
  onRoomClick: ((roomName: string) => void) | undefined;
  unreadMarkerMessageId?: string | null;
  onUnreadMarkerRead?: (roomId: string) => void;
  historyFailed?: boolean;
  onRetryHistory?: (roomId: string) => void;
  editLastRequest?: number;
  olderHistory?: OlderHistory | undefined;
  onLoadOlder?: ((roomId: string) => void) | undefined;
  searchQuery?: string;
}>) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [olderEnabled, setOlderEnabled] = useState(false);
  const [olderSentinel, setOlderSentinel] = useState<HTMLLIElement | null>(null);
  const listSnapshotRef = useRef<{
    firstId: string | undefined;
    lastId: string | undefined;
    height: number;
  } | null>(null);
  const unreadMarkerRef = useRef<HTMLLIElement>(null);
  const stuckToBottomRef = useRef(true);
  const editContentRef = useRef(editContent);
  const savingEditRef = useRef(false);
  const messagesRef = useRef(messages);
  const handledEditRequestRef = useRef(editLastRequest);
  const editingIdRef = useRef(editingMessageId);
  const focusAfterEditRef = useRef<string | null>(null);
  const username = useAuth().username;

  editContentRef.current = editContent;
  editingIdRef.current = editingMessageId;
  messagesRef.current = messages;

  const scrollToBottom = useCallback(() => {
    if (!scrollContainer) return;

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    stuckToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, [scrollContainer]);

  const handleScroll = useCallback(() => {
    if (!scrollContainer) return;

    const marker = unreadMarkerRef.current;
    if (
      marker &&
      marker.getBoundingClientRect().bottom <= scrollContainer.getBoundingClientRect().top
    ) {
      onUnreadMarkerRead?.(roomId);
    }

    stuckToBottomRef.current = isNearBottom(scrollContainer);
    if (stuckToBottomRef.current) setShowJumpToLatest(false);
  }, [onUnreadMarkerRead, roomId, scrollContainer]);

  useEffect(() => {
    if (!scrollContainer) return;

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [handleScroll, scrollContainer]);

  useEffect(() => {
    if (!scrollContainer || typeof ResizeObserver === "undefined") return;

    const keepPinnedToBottom = () => {
      if (stuckToBottomRef.current) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };
    const observer = new ResizeObserver(keepPinnedToBottom);
    observer.observe(scrollContainer);
    for (const child of Array.from(scrollContainer.children)) observer.observe(child);

    return () => observer.disconnect();
  }, [scrollContainer]);

  useEffect(() => {
    setOlderEnabled(false);
    if (loading) return;
    scrollToBottom();
    setOlderEnabled(true);
  }, [loading, roomId, scrollToBottom]);

  const firstMessageId = messages[0]?.id;
  const lastMessageId = messages[messages.length - 1]?.id;

  useLayoutEffect(() => {
    const snapshot = listSnapshotRef.current;
    const ends = { firstId: firstMessageId, lastId: lastMessageId };
    if (scrollContainer && snapshot && isPrepend(snapshot, ends)) {
      scrollContainer.scrollTop = anchoredScrollTop({
        scrollTop: scrollContainer.scrollTop,
        previousHeight: snapshot.height,
        height: scrollContainer.scrollHeight,
      });
    }
    listSnapshotRef.current = scrollContainer
      ? { ...ends, height: scrollContainer.scrollHeight }
      : null;
  }, [firstMessageId, lastMessageId, scrollContainer]);

  const hasMoreOlder = olderHistory !== undefined && olderHistory.nextBefore !== null;
  const olderIdle = hasMoreOlder && !olderHistory.loading && !olderHistory.failed;

  useEffect(() => {
    if (!scrollContainer || !olderSentinel || !olderEnabled || !olderIdle || !onLoadOlder) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadOlder(roomId);
      },
      { root: scrollContainer, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(olderSentinel);

    return () => observer.disconnect();
  }, [olderEnabled, olderIdle, olderSentinel, onLoadOlder, roomId, scrollContainer]);

  const latestMessage = messages[messages.length - 1];
  const latestMessageId = latestMessage?.id;
  const latestMessageIsMine = latestMessage?.username === username;

  useEffect(() => {
    if (loading || !latestMessageId) return;

    if (latestMessageIsMine || stuckToBottomRef.current) {
      scrollToBottom();
      return;
    }

    setShowJumpToLatest(true);
  }, [latestMessageId, latestMessageIsMine, loading, scrollToBottom]);

  useEffect(() => {
    if (loading || !unreadMarkerMessageId || !onUnreadMarkerRead) return;
    const marker = unreadMarkerRef.current;
    if (!scrollContainer || !marker) return;

    marker.scrollIntoView({ block: "center" });
    stuckToBottomRef.current = isNearBottom(scrollContainer);
  }, [loading, onUnreadMarkerRead, scrollContainer, unreadMarkerMessageId]);

  useEffect(() => {
    const messageId = focusAfterEditRef.current;
    if (editingMessageId !== null || !messageId || !scrollContainer) return;

    focusAfterEditRef.current = null;
    scrollContainer.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)?.focus();
  }, [editingMessageId, scrollContainer]);

  const closeEditing = useCallback((messageId: string) => {
    if (editingIdRef.current !== messageId) return;
    focusAfterEditRef.current = messageId;
    setEditingMessageId(null);
    setEditContent("");
  }, []);

  const startEditing = useCallback((message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  }, []);

  useEffect(() => {
    if (editLastRequest === handledEditRequestRef.current) return;
    handledEditRequestRef.current = editLastRequest;

    const target = lastOwnMessage(messagesRef.current, username);
    if (target) startEditing(target);
  }, [editLastRequest, startEditing, username]);

  const cancelEditing = useCallback(() => {
    const messageId = editingIdRef.current;
    if (messageId) closeEditing(messageId);
  }, [closeEditing]);

  const handleEditContentChange = useCallback((content: string) => {
    setEditContent(content);
  }, []);

  const editMessage = useCallback(
    async (messageId: string) => {
      const content = editContentRef.current.trim();

      if (!content || savingEditRef.current) return;

      const original = messagesRef.current.find((message) => message.id === messageId);
      if (original?.content === content) {
        closeEditing(messageId);
        return;
      }

      savingEditRef.current = true;

      try {
        await updateMessage(roomId, messageId, content);

        closeEditing(messageId);
      } catch (error) {
        console.error(`Falha ao editar a mensagem ${messageId}:`, error);
        toast.error("Não consegui salvar a edição. Tente de novo.", {
          id: "message-edit-failed",
        });
      } finally {
        savingEditRef.current = false;
      }
    },
    [closeEditing, roomId],
  );

  const handleSaveEdit = useCallback(
    (messageId: string) => {
      void editMessage(messageId);
    },
    [editMessage],
  );

  const searchTerm = searchQuery.trim();

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

  if (messages.length === 0 && historyFailed) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">
              Não consegui carregar o histórico de #{roomName}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => onRetryHistory?.(roomId)}
            >
              Tentar de novo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0 && searchTerm.length > 0) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma mensagem encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nada no histórico carregado combina com “{searchTerm}”.
            </p>
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
      {historyFailed && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <span>Não consegui atualizar o histórico.</span>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => onRetryHistory?.(roomId)}
          >
            Tentar de novo
          </Button>
        </div>
      )}
      <div
        ref={setScrollContainer}
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-4 [overflow-anchor:none] sm:px-4"
      >
        <ol className="space-y-0.5">
          {olderHistory && (
            <li
              ref={setOlderSentinel}
              className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
            >
              <span role="status">{olderStatusText(olderHistory)}</span>
              {olderHistory.failed && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => onLoadOlder?.(roomId)}
                >
                  Tentar de novo
                </Button>
              )}
            </li>
          )}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const dateLabel = dateGroupLabelFor(message.createdAt);
            const previousDateLabel = previous ? dateGroupLabelFor(previous.createdAt) : null;
            const startsDateGroup = dateLabel !== previousDateLabel;
            const startsUnreadGroup = message.id === unreadMarkerMessageId;
            const grouped =
              !startsDateGroup && !startsUnreadGroup && shouldGroupMessages(previous, message);
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
                {startsUnreadGroup && (
                  <li
                    ref={unreadMarkerRef}
                    role="separator"
                    aria-label="Mensagens não lidas"
                    className="flex items-center gap-3 py-4 text-xs font-medium text-primary"
                  >
                    <span className="h-px flex-1 bg-primary" />
                    <span>Não lidas desde a sua última visita</span>
                    <span className="h-px flex-1 bg-primary" />
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
                  onReply={onReply}
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
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md"
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
