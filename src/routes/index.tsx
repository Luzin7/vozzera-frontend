import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AuthForm } from "@/components/vozzera/AuthForm";
import { CreateRoomDialog } from "@/components/vozzera/CreateRoomDialog";
import { MessageComposer } from "@/components/vozzera/MessageComposer";
import { MessageList } from "@/components/vozzera/MessageList";
import { RoomSidebar } from "@/components/vozzera/RoomSidebar";
import { ScreenShareDialog } from "@/components/vozzera/ScreenShareDialog";
import { ScreenShareStage } from "@/components/vozzera/ScreenShareStage";
import { SettingsDialog } from "@/components/vozzera/SettingsDialog";
import type { ChatMessage, Room } from "@/lib/vozzera/types";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const voice = useVoice();
  const {
    micEnabled,
    screenShareEnabled,
    activeRoomId: voiceActiveRoomId,
    connect,
    disconnect,
    setMicEnabled,
    setScreenShare,
  } = voice;

  const handleDeleteMessage = useCallback(
    (message: ChatMessage) => void deleteMessage(message.id),
    [deleteMessage],
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!activeRoom) return;
      sendMessage(activeRoom.id, content);
    },
    [activeRoom, sendMessage],
  );

  const handleSelectRoom = useCallback((room: Room) => void openRoom(room), [openRoom]);

  const handleSelectVoiceRoom = useCallback(
    (room: Room) => {
      dismissBanner();
      if (voiceActiveRoomId === room.id) {
        void disconnect();
        return;
      }
      void connect(room.id);
    },
    [dismissBanner, voiceActiveRoomId, connect, disconnect],
  );

  const handleToggleMic = useCallback(
    () => void setMicEnabled(!micEnabled),
    [micEnabled, setMicEnabled],
  );

  const handleLeaveVoice = useCallback(() => void disconnect(), [disconnect]);

  const handleToggleScreenShare = useCallback(() => {
    if (screenShareEnabled) {
      void setScreenShare(false);
      return;
    }
    setScreenShareOpen(true);
  }, [screenShareEnabled, setScreenShare]);

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
        onSelectRoom={handleSelectRoom}
        onSelectVoiceRoom={handleSelectVoiceRoom}
        onCreateRoom={() => setCreateOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        username={username}
        status={socketStatus}
        voiceStatus={voice.status}
        voiceRoomId={voice.activeRoomId}
        voiceParticipants={voice.participants}
        micEnabled={voice.micEnabled}
        onToggleMic={handleToggleMic}
        onLeaveVoice={handleLeaveVoice}
        unread={unread}
        volumes={voice.volumes}
        onSetVolume={voice.setParticipantVolume}
        screenShareEnabled={voice.screenShareEnabled}
        onToggleScreenShare={handleToggleScreenShare}
        screenShares={voice.screenShares}
        mutedParticipants={voice.mutedParticipants}
        speakingNames={voice.speakingNames}
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
              onDelete={handleDeleteMessage}
            />
            <MessageComposer
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              disabled={socketStatus !== "open"}
              onSend={handleSendMessage}
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

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        username={username}
        micDevices={voice.micDevices}
        selectedDeviceId={voice.selectedDeviceId}
        noiseFilter={voice.noiseFilter}
        selfMonitor={voice.selfMonitor}
        onSelectDevice={(deviceId) => void voice.setMicDevice(deviceId)}
        onToggleNoiseFilter={(enabled) => void voice.setNoiseFilter(enabled)}
        onToggleSelfMonitor={(enabled) => void voice.setSelfMonitor(enabled)}
        onLogout={() => {
          void voice.disconnect();
          void logout();
        }}
      />
    </div>
  );
}
