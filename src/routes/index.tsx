import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthForm } from "@/components/vozzera/AuthForm";
import { CreateRoomDialog } from "@/components/vozzera/CreateRoomDialog";
import { MessageComposer } from "@/components/vozzera/MessageComposer";
import { MessageList } from "@/components/vozzera/MessageList";
import { RoomSidebar } from "@/components/vozzera/RoomSidebar";
import { ScreenShareDialog } from "@/components/vozzera/ScreenShareDialog";
import { ScreenShareStage } from "@/components/vozzera/ScreenShareStage";
import { useChat } from "@/lib/vozzera/useChat";
import { useVoice } from "@/lib/vozzera/useVoice";

const title = "Vozzera — servidor privado de chat e voz";
const description =
  "Chat em tempo real por convite: salas de texto, histórico e mensagens ao vivo para você e seus amigos.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const {
    username,
    authed,
    rooms,
    activeRoom,
    messages,
    banner,
    loadingHistory,
    unread,
    socketStatus,
    openRoom,
    createRoom,
    deleteMessage,
    logout,
    authenticate,
    dismissBanner,
    showBanner,
    notificationsEnabled,
    toggleNotifications,
    sendMessage,
  } = useChat();
  const [createOpen, setCreateOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const voice = useVoice();

  useEffect(() => {
    if (voice.error) showBanner(voice.error);
  }, [voice.error, showBanner]);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Conectando ao servidor...
      </div>
    );
  }

  if (!authed) {
    return <AuthForm onAuthenticated={authenticate} />;
  }

  const activeMessages = activeRoom ? (messages[activeRoom.id] ?? []) : [];

  return (
    <div className="flex h-screen bg-background">
      <RoomSidebar
        rooms={rooms}
        activeRoomId={activeRoom?.id ?? null}
        onSelectRoom={(room) => void openRoom(room)}
        onSelectVoiceRoom={(room) => {
          dismissBanner();
          if (voice.activeRoomId === room.id) return;
          void voice.connect(room.id);
        }}
        onCreateRoom={() => setCreateOpen(true)}
        onLogout={() => {
          void voice.disconnect();
          void logout();
        }}
        username={username}
        status={socketStatus}
        voiceStatus={voice.status}
        voiceRoomId={voice.activeRoomId}
        voiceParticipants={voice.participants}
        micEnabled={voice.micEnabled}
        onToggleMic={() => void voice.setMicEnabled(!voice.micEnabled)}
        onLeaveVoice={() => void voice.disconnect()}
        unread={unread}
        volumes={voice.volumes}
        onSetVolume={voice.setParticipantVolume}
        screenShareEnabled={voice.screenShareEnabled}
        onToggleScreenShare={() => {
          if (voice.screenShareEnabled) {
            void voice.setScreenShare(false);
          } else {
            setScreenShareOpen(true);
          }
        }}
        screenShares={voice.screenShares}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {activeRoom ? `# ${activeRoom.name}` : "Nenhuma sala selecionada"}
          </h1>
          <span className="text-xs text-muted-foreground">
            · todos os membros do servidor leem esta sala
          </span>
          {activeRoom && (
            <button
              className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => void toggleNotifications()}
              aria-label={
                notificationsEnabled
                  ? "Desativar notificações de desktop"
                  : "Ativar notificações de desktop"
              }
            >
              {notificationsEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </button>
          )}
        </header>

        {banner && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground"
          >
            <span>{banner}</span>
            <button onClick={dismissBanner} className="underline">
              ok
            </button>
          </div>
        )}

        {activeRoom ? (
          <>
            <ScreenShareStage
              shares={voice.screenShares}
              localPreview={voice.localPreview}
              isTabHidden={voice.isTabHidden}
            />
            <MessageList
              messages={activeMessages}
              loading={loadingHistory && activeMessages.length === 0}
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              onDelete={(message) => void deleteMessage(message.id)}
            />
            <MessageComposer
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              disabled={socketStatus !== "open"}
              onSend={(content) => sendMessage(activeRoom.id, content)}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">Nenhuma sala de texto ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie a primeira no botão + da barra lateral.
              </p>
            </div>
          </div>
        )}
      </main>

      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingRooms={rooms}
        onCreate={createRoom}
      />

      <ScreenShareDialog
        open={screenShareOpen}
        onOpenChange={setScreenShareOpen}
        onStart={(quality) => void voice.setScreenShare(true, quality)}
      />
    </div>
  );
}
