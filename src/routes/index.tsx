import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AuthForm } from "@/components/vozzera/AuthForm";
import { CreateRoomDialog } from "@/components/vozzera/CreateRoomDialog";
import { EmailRequiredScreen } from "@/components/vozzera/EmailRequiredScreen";
import { MessageComposer } from "@/components/vozzera/MessageComposer";
import { MessageList } from "@/components/vozzera/MessageList";
import { RoomSidebar } from "@/components/vozzera/RoomSidebar";
import { ScreenShareDialog } from "@/components/vozzera/ScreenShareDialog";
import { SettingsDialog } from "@/components/vozzera/SettingsDialog";
import { VoiceCallView } from "@/components/vozzera/VoiceCallView";
import type { ChatMessage, Room } from "@/lib/vozzera/types";
import { requiresEmailSetup } from "@/lib/vozzera/auth-validation";
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
    email,
    authed,
    rooms,
    canManageRooms,
    activeRoom,
    messages,
    banner,
    loadingHistory,
    unread,
    socketStatus,
    openRoom,
    createRoom,
    updateRoom,
    deleteRoom,
    deleteMessage,
    logout,
    authenticate,
    dismissBanner,
    showBanner,
    updateEmail,
    notificationsEnabled,
    toggleNotifications,
    sendMessage,
  } = useChat();
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const [visibleVoiceRoomId, setVisibleVoiceRoomId] = useState<string | null>(null);
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

  const handleSelectRoom = useCallback(
    (room: Room) => {
      setVisibleVoiceRoomId(null);
      void openRoom(room);
    },
    [openRoom],
  );

  const handleSelectVoiceRoom = useCallback(
    (room: Room) => {
      dismissBanner();
      setVisibleVoiceRoomId(room.id);
      if (voiceActiveRoomId === room.id) return;
      void connect(room.id);
    },
    [dismissBanner, voiceActiveRoomId, connect],
  );

  const handleCreateRoom = useCallback(() => {
    setEditingRoom(null);
    setRoomDialogOpen(true);
  }, []);

  const handleEditRoom = useCallback((room: Room) => {
    setEditingRoom(room);
    setRoomDialogOpen(true);
  }, []);

  const handleDeleteRoom = useCallback(
    async (room: Room) => {
      try {
        await deleteRoom(room.id);
      } catch {
        showBanner("Não foi possível apagar a sala.");
      }
    },
    [deleteRoom, showBanner],
  );

  const handleDeleteRoomVoid = useCallback(
    (room: Room) => void handleDeleteRoom(room),
    [handleDeleteRoom],
  );

  const handleToggleMic = useCallback(
    () => void setMicEnabled(!micEnabled),
    [micEnabled, setMicEnabled],
  );

  const handleLeaveVoice = useCallback(() => {
    setVisibleVoiceRoomId(null);
    void disconnect();
  }, [disconnect]);

  const handleToggleScreenShare = useCallback(() => {
    if (screenShareEnabled) {
      void setScreenShare(false);
      return;
    }
    setScreenShareOpen(true);
  }, [screenShareEnabled, setScreenShare]);

  const handleLogout = useCallback(() => {
    void disconnect();
    void logout();
  }, [disconnect, logout]);

  useEffect(() => {
    if (voice.error) showBanner(voice.error);
  }, [voice.error, showBanner]);

  useEffect(() => {
    if (!voiceActiveRoomId) return;
    if (rooms.some((room) => room.id === voiceActiveRoomId)) return;

    setVisibleVoiceRoomId(null);
    void disconnect();
  }, [rooms, voiceActiveRoomId, disconnect]);

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

  if (requiresEmailSetup(email)) {
    return <EmailRequiredScreen onUpdateEmail={updateEmail} onLogout={handleLogout} />;
  }

  const activeMessages = activeRoom ? (messages[activeRoom.id] ?? []) : [];
  const visibleVoiceRoom =
    voice.status === "idle" ? null : (rooms.find((room) => room.id === visibleVoiceRoomId) ?? null);

  return (
    <div className="flex h-screen bg-background">
      <RoomSidebar
        rooms={rooms}
        activeRoomId={visibleVoiceRoom ? null : (activeRoom?.id ?? null)}
        visibleVoiceRoomId={visibleVoiceRoom?.id ?? null}
        onSelectRoom={handleSelectRoom}
        onSelectVoiceRoom={handleSelectVoiceRoom}
        onCreateRoom={handleCreateRoom}
        canManageRooms={canManageRooms}
        onEditRoom={handleEditRoom}
        onDeleteRoom={handleDeleteRoomVoid}
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
        onToggleLocalMute={voice.toggleLocalMute}
        screenShareEnabled={voice.screenShareEnabled}
        onToggleScreenShare={handleToggleScreenShare}
        screenShares={voice.screenShares}
        mutedParticipants={voice.mutedParticipants}
        speakingNames={voice.speakingNames}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {visibleVoiceRoom ? (
              <span className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                {visibleVoiceRoom.name}
              </span>
            ) : activeRoom ? (
              `# ${activeRoom.name}`
            ) : (
              "Nenhuma sala selecionada"
            )}
          </h1>
          {!visibleVoiceRoom && (
            <span className="text-xs text-muted-foreground">
              · todos os membros do servidor leem esta sala
            </span>
          )}
          {activeRoom && !visibleVoiceRoom && (
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

        {visibleVoiceRoom ? (
          <VoiceCallView
            roomName={visibleVoiceRoom.name}
            status={voice.status}
            participants={voice.participants}
            username={username}
            micEnabled={voice.micEnabled}
            mutedParticipants={voice.mutedParticipants}
            speakingNames={voice.speakingNames}
            screenShareEnabled={voice.screenShareEnabled}
            screenShares={voice.screenShares}
            localPreview={voice.localPreview}
            isTabHidden={voice.isTabHidden}
            onToggleMic={handleToggleMic}
            onToggleScreenShare={handleToggleScreenShare}
            onLeave={handleLeaveVoice}
          />
        ) : activeRoom ? (
          <>
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
                {canManageRooms
                  ? "Crie a primeira no botão + da barra lateral."
                  : "Aguarde um moderador criar uma sala."}
              </p>
            </div>
          </div>
        )}
      </main>

      <CreateRoomDialog
        key={editingRoom?.id ?? "create"}
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        existingRooms={rooms}
        room={editingRoom}
        onCreate={createRoom}
        onUpdate={updateRoom}
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
        email={email}
        micDevices={voice.micDevices}
        selectedDeviceId={voice.selectedDeviceId}
        noiseFilter={voice.noiseFilter}
        krispSupported={voice.krispSupported}
        selfMonitor={voice.selfMonitor}
        onSelectDevice={(deviceId) => void voice.setMicDevice(deviceId)}
        onToggleNoiseFilter={(enabled) => void voice.setNoiseFilter(enabled)}
        onToggleSelfMonitor={(enabled) => void voice.setSelfMonitor(enabled)}
        onUpdateEmail={updateEmail}
        onLogout={handleLogout}
      />
    </div>
  );
}
