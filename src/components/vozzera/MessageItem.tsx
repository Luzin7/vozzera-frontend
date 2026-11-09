import { memo, useEffect, useLayoutEffect, useRef } from "react";

import { avatarColorClass, initials } from "@/lib/vozzera/avatar";
import {
  editorKeyAction,
  formatEditedAt,
  formatMessageDateTime,
  formatMessageTime,
  wasEdited,
} from "@/lib/vozzera/message-display";
import type { ChatMessage } from "@/lib/vozzera/types";
import { Check, MoreHorizontal, Pen, Reply, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/vozzera/Markdown";
import { replyPreviewText } from "@/lib/vozzera/reply-preview";

function EditedLabel({ message }: Readonly<{ message: ChatMessage }>) {
  if (!wasEdited(message)) return null;

  return (
    <span className="text-[11px] text-muted-foreground" title={formatEditedAt(message.updatedAt)}>
      (editado)
    </span>
  );
}

function MessageEditor({
  messageId,
  value,
  onChange,
  onSave,
  onCancel,
}: Readonly<{
  messageId: string;
  value: string;
  onChange: (content: string) => void;
  onSave: (messageId: string) => void;
  onCancel: () => void;
}>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <div>
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          id={`message-edit-${messageId}`}
          value={value}
          rows={1}
          autoComplete="off"
          className="max-h-60 min-h-9 resize-none overflow-y-auto py-1.5 leading-5"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const action = editorKeyAction({
              key: event.key,
              shiftKey: event.shiftKey,
              isComposing: event.nativeEvent.isComposing,
            });
            if (action === "save") {
              event.preventDefault();
              onSave(messageId);
            }
            if (action === "cancel") onCancel();
          }}
        />

        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="secondary"
            className="h-8 w-8 p-0 text-primary [&_svg]:size-4"
            onClick={() => onSave(messageId)}
          >
            <Check />
            <span className="sr-only">Salvar edição</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="h-8 w-8 p-0 text-muted-foreground [&_svg]:size-4"
            onClick={onCancel}
          >
            <X />
            <span className="sr-only">Cancelar edição</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageActions({
  isOwnMessage,
  canReply,
  canDeleteMessage,
  onReply,
  onEdit,
  onDelete,
}: Readonly<{
  isOwnMessage: boolean;
  canReply: boolean;
  canDeleteMessage: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 select-none md:hidden">
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
          {canReply && (
            <DropdownMenuItem onClick={onReply}>
              <Reply className="h-4 w-4" />
              Responder
            </DropdownMenuItem>
          )}
          {isOwnMessage && (
            <DropdownMenuItem onClick={onEdit}>
              <Pen className="h-4 w-4" />
              Editar mensagem
            </DropdownMenuItem>
          )}
          {canDeleteMessage && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Excluir mensagem
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DesktopMessageActions({
  isOwnMessage,
  canReply,
  canDeleteMessage,
  onReply,
  onEdit,
  onDelete,
}: Readonly<{
  isOwnMessage: boolean;
  canReply: boolean;
  canDeleteMessage: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-20 hidden select-none gap-1 opacity-0 transition-opacity md:flex md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:focus-within:opacity-100">
      {canReply && (
        <Button
          variant="secondary"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground [&_svg]:size-4"
          onClick={onReply}
        >
          <Reply />
          <span className="sr-only">Responder mensagem</span>
        </Button>
      )}
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
      {canDeleteMessage && (
        <Button
          variant="secondary"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive [&_svg]:size-4"
          onClick={onDelete}
        >
          <Trash2 />
          <span className="sr-only">Excluir mensagem</span>
        </Button>
      )}
    </div>
  );
}

type MessageItemProps = Readonly<{
  message: ChatMessage;
  grouped: boolean;
  isLast: boolean;
  isOwnMessage: boolean;
  canDeleteMessage: boolean;
  isEditing: boolean;
  editContent: string;
  onStartEdit: (message: ChatMessage) => void;
  onRequestDelete: (message: ChatMessage) => void;
  onReply?: ((message: ChatMessage) => void) | undefined;
  onEditContentChange: (content: string) => void;
  onSaveEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onRoomClick: ((roomName: string) => void) | undefined;
}>;

export const MessageItem = memo(function MessageItem({
  message,
  grouped,
  isLast,
  isOwnMessage,
  canDeleteMessage,
  isEditing,
  editContent,
  onStartEdit,
  onRequestDelete,
  onReply,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onRoomClick,
}: MessageItemProps) {
  const canReply = onReply !== undefined;
  const hasActions = !isEditing && (canReply || canDeleteMessage);

  return (
    <li
      data-message-id={message.id}
      tabIndex={-1}
      className={`rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${grouped ? "" : "pt-3"} ${!isLast ? "[content-visibility:auto] [contain-intrinsic-size:auto_4rem]" : ""}`}
    >
      <div className="group relative flex gap-2 rounded-md px-1 py-0.5 hover:z-10 hover:bg-muted/40 sm:gap-3 sm:px-2">
        <div className="w-9 shrink-0">
          {grouped ? (
            <time
              dateTime={message.createdAt}
              title={formatMessageDateTime(message.createdAt)}
              className="block pt-1 text-right text-[10px] leading-5 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-60"
            >
              {formatMessageTime(message.createdAt)}
            </time>
          ) : (
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-md font-mono text-xs font-semibold ${avatarColorClass(message.username)}`}
            >
              {initials(message.username)}
            </div>
          )}
        </div>

        <div className="relative min-w-0 flex-1 md:min-h-6">
          {!grouped && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">{message.username}</span>

              <time
                dateTime={message.createdAt}
                title={formatMessageDateTime(message.createdAt)}
                className="text-[11px] text-muted-foreground"
              >
                {formatMessageTime(message.createdAt)}
              </time>
              <EditedLabel message={message} />
            </div>
          )}

          {hasActions && (
            <DesktopMessageActions
              isOwnMessage={isOwnMessage}
              canReply={canReply}
              canDeleteMessage={canDeleteMessage}
              onReply={() => onReply?.(message)}
              onEdit={() => onStartEdit(message)}
              onDelete={() => onRequestDelete(message)}
            />
          )}

          {message.replyTo && (
            <div className="mb-1 flex min-w-0 max-w-full items-center gap-1.5 border-l-2 border-primary/60 bg-muted/40 px-2 py-0.5 text-xs">
              <span className="shrink-0 font-medium text-foreground/80">
                @{message.replyTo.username}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {replyPreviewText(message.replyTo.content)}
              </span>
            </div>
          )}

          {isEditing ? (
            <MessageEditor
              messageId={message.id}
              value={editContent}
              onChange={onEditContentChange}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <div
              className={`relative text-sm leading-relaxed text-foreground/90 ${hasActions ? "pr-12 md:pr-0" : ""}`}
            >
              <Markdown content={message.content} onRoomClick={onRoomClick} />
              {grouped && <EditedLabel message={message} />}
              {hasActions && (
                <MessageActions
                  isOwnMessage={isOwnMessage}
                  canReply={canReply}
                  canDeleteMessage={canDeleteMessage}
                  onReply={() => onReply?.(message)}
                  onEdit={() => onStartEdit(message)}
                  onDelete={() => onRequestDelete(message)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
});
