import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppProviders } from "@/components/vozzera/AppProviders";
import { RoomSidebar } from "@/components/vozzera/RoomSidebar";

const noop = () => {};
const room = { id: "r1", name: "Geral", has_voice: true } as never;
const props = {
  rooms: [room],
  activeRoomId: null,
  visibleVoiceRoomId: "r1",
  onSelectRoom: noop,
  onSelectVoiceRoom: noop,
  onCreateRoom: noop,
  canManageRooms: false,
  onOpenVoiceChat: noop,
  onOpenRoomSettings: noop,
  voiceChatOpen: false,
  settingsRoomId: null,
  onOpenSettings: noop,
  username: "ana",
  status: "open",
  voiceStatus: "connected",
  voiceRoomId: "r1",
  voiceParticipants: [],
  voicePresence: {},
  awayPresence: {},
  micEnabled: true,
  onToggleMic: noop,
  onLeaveVoice: noop,
  unread: {},
  volumes: {},
  screenShareVolumes: {},
  onSetVolume: noop,
  onSetScreenShareVolume: noop,
  onToggleLocalMute: noop,
  onToggleLocalScreenShareMute: noop,
  screenShareEnabled: false,
  onToggleScreenShare: noop,
  screenShares: [],
  mutedParticipants: {},
  deafenedParticipants: {},
  deafen: false,
  onToggleDeafen: noop,
};
const sidebar = () => h(RoomSidebar, props as never);

describe("AppProviders", () => {
  it("connected voice panel crashes without the root provider", () => {
    expect(() => renderToString(sidebar())).toThrow(/TooltipProvider/);
  });

  it("connected voice panel renders inside AppProviders", () => {
    expect(() => renderToString(h(AppProviders, null, sidebar()))).not.toThrow();
  });
});
