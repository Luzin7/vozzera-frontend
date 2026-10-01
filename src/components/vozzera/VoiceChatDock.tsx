import { MessageSquare, X } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/vozzera/MessageComposer";
import { MessageList } from "@/components/vozzera/MessageList";
import type { ChatMessage } from "@/lib/vozzera/types";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  roomId: string;
  roomName: string;
  messages: ChatMessage[];
  loading: boolean;
  typingText: string | null;
  canModerateMessages: boolean;
  disabled: boolean;
  onDelete: (message: ChatMessage) => void;
  onSend: (content: string) => void;
  onTypingChange: (typing: boolean) => void;
  onClose: () => void;
};

export const VoiceChatDock = memo(function VoiceChatDock({
  className,
  roomId,
  roomName,
  messages,
  loading,
  typingText,
  canModerateMessages,
  disabled,
  onDelete,
  onSend,
  onTypingChange,
  onClose,
}: Readonly<Props>) {
  return (
    <aside
      className={cn(
        "flex min-w-0 shrink-0 flex-col border-l border-border bg-background md:w-80 lg:w-96",
        className,
      )}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          Chat · #{roomName}
        </h2>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-11 w-11 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar chat da call</span>
        </Button>
      </header>

      <MessageList
        messages={messages}
        loading={loading}
        roomId={roomId}
        roomName={roomName}
        typingText={typingText}
        canModerateMessages={canModerateMessages}
        onDelete={onDelete}
        onRoomClick={undefined}
      />
      <MessageComposer
        roomId={roomId}
        roomName={roomName}
        disabled={disabled}
        onSend={onSend}
        onTypingChange={onTypingChange}
      />
    </aside>
  );
});
