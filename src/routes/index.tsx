import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, Menu, Volume2 } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";

import { AuthForm } from "@/components/vozzera/AuthForm";
import { CreateRoomDialog } from "@/components/vozzera/CreateRoomDialog";
import { EmailRequiredScreen } from "@/components/vozzera/EmailRequiredScreen";
import { MessageComposer } from "@/components/vozzera/MessageComposer";
import { MessageList } from "@/components/vozzera/MessageList";
import { RoomSidebar } from "@/components/vozzera/RoomSidebar";
import { WhatsNewDialog } from "@/components/vozzera/WhatsNewDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnline } from "@/hooks/useOnline";
import { typingIndicatorText } from "@/lib/vozzera/chat";
import type { ChatMessage, Room } from "@/lib/vozzera/types";
import { requiresEmailSetup } from "@/lib/vozzera/auth-validation";
import { useChangelog } from "@/lib/vozzera/useChangelog";
import { useChat } from "@/lib/vozzera/useChat";
import { useVoice } from "@/lib/vozzera/useVoice";

const VoiceCallView = lazy(() =>
  import("@/components/vozzera/VoiceCallView").then((m) => ({ default: m.VoiceCallView })),
);
const ScreenShareDialog = lazy(() =>
  import("@/components/vozzera/ScreenShareDialog").then((m) => ({ default: m.ScreenShareDialog })),
);
const SettingsDialog = lazy(() =>
  import("@/components/vozzera/SettingsDialog").then((m) => ({ default: m.SettingsDialog })),
);

const title = "Vozzera — servidor privado de chat e voz";
const description =
  "Chat em tempo real por convite: salas de texto, histórico e mensagens ao vivo para você e seus amigos.";
const offlineBanner = "Você está offline. A conexão volta sozinha.";

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
    currentUserId,
    authed,
    rooms,
    canManageRooms,
    canModerateMessages,
    activeRoom,
    messages,
    banner,
    loadingHistory,
    unread,
    typingUsers,
    voicePresence,
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
    soundEnabled,
    toggleSound,
    sendMessage,
    setTyping,
  } = useChat();
  const {
    changelog,
    shouldShow: shouldShowChangelog,
    dismiss: dismissChangelog,
  } = useChangelog(authed === true);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screenShareOpen, setScreenShareOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [visibleVoiceRoomId, setVisibleVoiceRoomId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const isOnline = useOnline();
  const voice = useVoice();
  const {
    micEnabled,
    screenShareEnabled,
    activeRoomId: voiceActiveRoomId,
    connect,
    disconnect,
    setMicEnabled,
    setScreenShare,
    ensureKrispLoaded,
    toggleDeafen,
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
      setSidebarOpen(false);
      setVisibleVoiceRoomId(null);
      void openRoom(room);
    },
    [openRoom],
  );

  const handleRoomMention = useCallback(
    (roomName: string) => {
      const room = rooms.find((r) => r.name === roomName);
      if (room) handleSelectRoom(room);
    },
    [rooms, handleSelectRoom],
  );

  const handleSelectVoiceRoom = useCallback(
    (room: Room) => {
      setSidebarOpen(false);
      dismissBanner();
      setVisibleVoiceRoomId(room.id);
      if (voiceActiveRoomId === room.id) return;
      void connect(room.id);
    },
    [dismissBanner, voiceActiveRoomId, connect],
  );

  const handleCreateRoom = useCallback(() => {
    setSidebarOpen(false);
    setEditingRoom(null);
    setRoomDialogOpen(true);
  }, []);

  const handleEditRoom = useCallback((room: Room) => {
    setSidebarOpen(false);
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

  const handleToggleDeafen = useCallback(() => toggleDeafen(), [toggleDeafen]);

  const handleLogout = useCallback(() => {
    setSettingsOpen(false);
    void disconnect();
    void logout();
  }, [disconnect, logout]);

  const handleOpenSettings = useCallback(() => {
    setSidebarOpen(false);
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (voice.error) showBanner(voice.error);
  }, [voice.error, showBanner]);

  useEffect(() => {
    if (settingsOpen) void ensureKrispLoaded();
  }, [settingsOpen, ensureKrispLoaded]);

  useEffect(() => {
    if (!isOnline) {
      showBanner(offlineBanner);
      return;
    }

    if (banner === offlineBanner) dismissBanner();
  }, [isOnline, banner, showBanner, dismissBanner]);

  useEffect(() => {
    if (isMobile) return;
    setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!voiceActiveRoomId) return;
    if (rooms.some((room) => room.id === voiceActiveRoomId)) return;

    setVisibleVoiceRoomId(null);
    void disconnect();
  }, [rooms, voiceActiveRoomId, disconnect]);

  const activeMessages = activeRoom ? (messages[activeRoom.id] ?? []) : [];
  const typingText = activeRoom
    ? typingIndicatorText(Object.values(typingUsers[activeRoom.id] ?? {}))
    : null;
  const visibleVoiceRoom =
    voice.status === "idle" ? null : (rooms.find((room) => room.id === visibleVoiceRoomId) ?? null);
  const sidebarProps = {
    rooms,
    activeRoomId: visibleVoiceRoom ? null : (activeRoom?.id ?? null),
    visibleVoiceRoomId: visibleVoiceRoom?.id ?? null,
    onSelectRoom: handleSelectRoom,
    onSelectVoiceRoom: handleSelectVoiceRoom,
    onCreateRoom: handleCreateRoom,
    canManageRooms,
    onEditRoom: handleEditRoom,
    onDeleteRoom: handleDeleteRoomVoid,
    onOpenSettings: handleOpenSettings,
    username,
    currentUserId,
    status: socketStatus,
    voiceStatus: voice.status,
    voiceRoomId: voice.activeRoomId,
    voiceParticipants: voice.participants,
    voicePresence,
    micEnabled: voice.micEnabled,
    onToggleMic: handleToggleMic,
    onLeaveVoice: handleLeaveVoice,
    unread,
    volumes: voice.volumes,
    screenShareVolumes: voice.screenShareVolumes,
    onSetVolume: voice.setParticipantVolume,
    onSetScreenShareVolume: voice.setScreenShareVolume,
    onToggleLocalMute: voice.toggleLocalMute,
    onToggleLocalScreenShareMute: voice.toggleLocalScreenShareMute,
    screenShareEnabled: voice.screenShareEnabled,
    onToggleScreenShare: handleToggleScreenShare,
    screenShares: voice.screenShares,
    mutedParticipants: voice.mutedParticipants,
    speakingNames: voice.speakingNames,
    deafen: voice.deafen,
    onToggleDeafen: handleToggleDeafen,
  };

  if (authed === null) {
    return (
      <div className="flex h-dvh overflow-hidden bg-background">
        <RoomSidebar {...sidebarProps} loading className="hidden md:flex" />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 w-full shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
            <Skeleton className="h-4 w-40" />
          </header>
          <MessageList
            loading
            messages={[]}
            roomId=""
            roomName=""
            typingText={null}
            canModerateMessages={false}
            onDelete={() => {}}
            onRoomClick={undefined}
          />
        </main>
      </div>
    );
  }

  if (!authed) {
    return <AuthForm onAuthenticated={authenticate} />;
  }

  if (requiresEmailSetup(email)) {
    return <EmailRequiredScreen onUpdateEmail={updateEmail} onLogout={handleLogout} />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {isMobile ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="h-dvh w-[min(20rem,calc(100vw-2rem))] max-w-none p-0 [&>button]:right-2 [&>button]:top-1.5 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center"
          >
            <SheetTitle className="sr-only">Salas do Vozzera</SheetTitle>
            <RoomSidebar {...sidebarProps} className="h-full w-full border-r-0" />
          </SheetContent>
        </Sheet>
      ) : (
        <RoomSidebar {...sidebarProps} className="hidden md:flex" />
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 w-full shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu de salas"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 truncate text-sm font-semibold text-foreground">
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
            <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">
              · todos os membros do servidor leem esta sala
            </span>
          )}
          {activeRoom && !visibleVoiceRoom && (
            <button
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <Suspense
            fallback={
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            }
          >
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
              onToggleMic={handleToggleMic}
              onToggleScreenShare={handleToggleScreenShare}
              onLeave={handleLeaveVoice}
            />
          </Suspense>
        ) : activeRoom ? (
          <>
            <MessageList
              messages={activeMessages}
              loading={loadingHistory && activeMessages.length === 0}
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              typingText={typingText}
              canModerateMessages={canModerateMessages}
              onDelete={handleDeleteMessage}
              onRoomClick={handleRoomMention}
            />
            <MessageComposer
              roomId={activeRoom.id}
              roomName={activeRoom.name}
              disabled={socketStatus !== "open"}
              onSend={handleSendMessage}
              onTypingChange={setTyping}
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

      <Suspense fallback={null}>
        <ScreenShareDialog
          open={screenShareOpen}
          onOpenChange={setScreenShareOpen}
          onStart={(quality) => void voice.setScreenShare(true, quality)}
        />
      </Suspense>

      <Suspense fallback={null}>
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
          soundEnabled={soundEnabled}
          onSelectDevice={(deviceId) => void voice.setMicDevice(deviceId)}
          onToggleNoiseFilter={(enabled) => void voice.setNoiseFilter(enabled)}
          onToggleSelfMonitor={(enabled) => void voice.setSelfMonitor(enabled)}
          onToggleSound={toggleSound}
          onUpdateEmail={updateEmail}
          onLogout={handleLogout}
        />
      </Suspense>

      <WhatsNewDialog
        open={shouldShowChangelog}
        items={changelog?.items ?? []}
        version={changelog?.version ?? ""}
        onDismiss={dismissChangelog}
      />
    </div>
  );
}
