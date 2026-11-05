import type { DisconnectReason } from "livekit-client";

import type { CallParticipant } from "@/lib/vozzera/call-participants";
import type { AwayIntent } from "@/lib/vozzera/away-intent";
import type { AwayEntry, VoiceParticipant } from "@/lib/vozzera/types";
import { voiceDisconnectMessageFor } from "@/lib/vozzera/voice-errors";

export type { AwayEntry } from "@/lib/vozzera/types";

export const ALONE_LEAVE_MS = 150_000;
export const WITH_OTHERS_AWAY_MS = 300_000;
export const INACTIVITY_WARNING_MS = 30_000;

export type InactivityInputs = {
  connected: boolean;
  alone: boolean;
  live: boolean;
  lastActivityAt: number;
  aloneSince: number | null;
};

export type InactivityAction = "warn" | "away" | "leave" | null;

function deadlineFor(inputs: InactivityInputs): number {
  if (!inputs.alone) return inputs.lastActivityAt + WITH_OTHERS_AWAY_MS;
  return (
    Math.max(inputs.aloneSince ?? inputs.lastActivityAt, inputs.lastActivityAt) + ALONE_LEAVE_MS
  );
}

function isIdleTrackable(inputs: InactivityInputs): boolean {
  return inputs.connected && !inputs.live;
}

export function inactivityActionAt(inputs: InactivityInputs, now: number): InactivityAction {
  if (!isIdleTrackable(inputs)) return null;

  const deadline = deadlineFor(inputs);
  if (now >= deadline) return inputs.alone ? "leave" : "away";
  if (now >= deadline - INACTIVITY_WARNING_MS) return "warn";
  return null;
}

export function nextInactivityCheckAt(inputs: InactivityInputs, now: number): number | null {
  if (!isIdleTrackable(inputs)) return null;

  const deadline = deadlineFor(inputs);
  if (now >= deadline) return null;
  if (now >= deadline - INACTIVITY_WARNING_MS) return deadline;
  return deadline - INACTIVITY_WARNING_MS;
}

export function isConnectionLossReason(reason: DisconnectReason | undefined): boolean {
  return voiceDisconnectMessageFor(reason) === voiceDisconnectMessageFor(undefined);
}

export type AwayPresence = Record<string, AwayEntry[]>;

function sameEntries(a: AwayEntry[], b: AwayEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.userId === b[index]?.userId &&
        entry.username === b[index]?.username &&
        entry.since === b[index]?.since,
    )
  );
}

export function applyAwaySnapshot(
  presence: AwayPresence,
  roomId: string,
  entries: AwayEntry[],
): AwayPresence {
  const current = presence[roomId];

  if (entries.length === 0) {
    if (current === undefined) return presence;
    const { [roomId]: _removed, ...rest } = presence;
    return rest;
  }

  if (current !== undefined && sameEntries(current, entries)) return presence;
  return { ...presence, [roomId]: entries };
}

export function ownAwayEnded(
  confirmed: boolean,
  entries: AwayEntry[] | undefined,
  ownUserId: string,
): boolean {
  if (!confirmed) return false;
  return !(entries ?? []).some((entry) => entry.userId === ownUserId);
}

export type CallTile = { identity: string; name: string; isLocal: boolean; isAway: boolean };

export function callTilesFor(
  liveKit: CallParticipant[],
  away: AwayEntry[],
  localIdentity: string | null,
): CallTile[] {
  const present = new Set(liveKit.map((participant) => participant.identity));
  const awayTiles = away
    .filter((entry) => !present.has(entry.userId))
    .map((entry) => ({
      identity: entry.userId,
      name: entry.username,
      isLocal: entry.userId === localIdentity,
      isAway: true,
    }));

  return [...liveKit.map((participant) => ({ ...participant, isAway: false })), ...awayTiles];
}

export function sidebarEntriesFor(
  presence: VoiceParticipant[],
  away: AwayEntry[],
): { userId: string; username: string; isAway: boolean }[] {
  const present = new Set(presence.map((participant) => participant.user_id));
  const awayRows = away
    .filter((entry) => !present.has(entry.userId))
    .map((entry) => ({ userId: entry.userId, username: entry.username, isAway: true }));

  return [
    ...presence.map((participant) => ({
      userId: participant.user_id,
      username: participant.username,
      isAway: false,
    })),
    ...awayRows,
  ];
}

export const ACTIVITY_THROTTLE_MS = 10_000;

export type DisconnectRoute = "away" | "exit" | "default";

export function disconnectRouteFor(
  reason: DisconnectReason | undefined,
  remoteCount: number,
): DisconnectRoute {
  if (!isConnectionLossReason(reason)) return "default";
  return remoteCount > 0 ? "away" : "exit";
}

export const MAX_AWAY_RESENDS = 3;
export const AWAY_RESEND_WINDOW_MS = 60_000;

export type AwayEndedAction = "end" | "end_quiet" | "resend" | "ignore";

type AwayEndedInput = { roomId: string; userId: string; reason: string };

export type AwayEndedContext = {
  awayPresence: AwayPresence;
  voicePresence: Record<string, VoiceParticipant[]>;
  resendTimes: readonly number[];
  now: number;
};

const RESEND_REASONS: ReadonlySet<string> = new Set(["connection_closed", "snapshot_absent"]);

export function recentResends(times: readonly number[], now: number): number[] {
  return times.filter((time) => now - time < AWAY_RESEND_WINDOW_MS);
}

export type EndMode = "drop" | "leave";

export function endModeFor(resendTimes: readonly number[], now: number): EndMode {
  return recentResends(resendTimes, now).length > 0 ? "leave" : "drop";
}

function ownIsElsewhere(
  ownUserId: string,
  intentRoomId: string,
  context: AwayEndedContext,
): boolean {
  const inOtherRoom = (rooms: Record<string, { userId: string }[]>) =>
    Object.entries(rooms).some(
      ([roomId, entries]) =>
        roomId !== intentRoomId && entries.some((entry) => entry.userId === ownUserId),
    );
  const voiceRooms = Object.fromEntries(
    Object.entries(context.voicePresence).map(([roomId, list]) => [
      roomId,
      list.map((participant) => ({ userId: participant.user_id })),
    ]),
  );
  return inOtherRoom(context.awayPresence) || inOtherRoom(voiceRooms);
}

export function awayEndedActionFor(
  event: AwayEndedInput,
  ownUserId: string | null,
  intent: AwayIntent | null,
  context: AwayEndedContext,
): AwayEndedAction {
  if (ownUserId === null || intent === null) return "ignore";
  if (event.userId !== ownUserId || event.roomId !== intent.roomId) return "ignore";
  if (event.reason === "room_empty") return "end";
  if (!RESEND_REASONS.has(event.reason)) return "end_quiet";
  if (ownIsElsewhere(ownUserId, intent.roomId, context)) return "end_quiet";
  if (recentResends(context.resendTimes, context.now).length >= MAX_AWAY_RESENDS) return "end";
  return "resend";
}

export function latestActivityAt(moments: ReadonlyArray<number | null | undefined>): number {
  return moments.reduce<number>((latest, moment) => Math.max(latest, moment ?? 0), 0);
}

export function shouldRecordActivity(lastRecordedAt: number | null, now: number): boolean {
  return lastRecordedAt === null || now - lastRecordedAt >= ACTIVITY_THROTTLE_MS;
}

export type ExitNoticeReason = "inactivity" | "room_empty" | "connection";

const INACTIVITY_EXIT_TEXT = "Você saiu da call por inatividade";
const CONNECTION_LOST_TEXT = "A conexão de voz caiu.";

export function exitNoticeTextFor(reason: ExitNoticeReason): string {
  return reason === "connection" ? CONNECTION_LOST_TEXT : INACTIVITY_EXIT_TEXT;
}

export function inactivityWarningTextFor(alone: boolean): string {
  return alone
    ? "Você vai sair da call em 30 segundos por inatividade."
    : "Você vai ficar ausente em 30 segundos por inatividade.";
}

export const OWN_AWAY_TEXT = "Você está ausente";
export const AWAY_TOOLTIP_TEXT = "Ausente, não está ouvindo";

type CallTilesViewInput = {
  status: "idle" | "connecting" | "connected" | "away";
  liveKit: CallParticipant[];
  presence: VoiceParticipant[];
  away: AwayEntry[];
  own: { userId: string; username: string } | null;
};

function presenceAsParticipants(presence: VoiceParticipant[], ownUserId: string | null) {
  return presence
    .filter((participant) => participant.user_id !== ownUserId)
    .map((participant) => ({
      identity: participant.user_id,
      name: participant.username,
      isLocal: false,
    }));
}

function withOwnAwayEntry(away: AwayEntry[], own: { userId: string; username: string }) {
  if (away.some((entry) => entry.userId === own.userId)) return away;
  return [...away, { userId: own.userId, username: own.username, since: "" }];
}

export function callTilesForView({
  status,
  liveKit,
  presence,
  away,
  own,
}: CallTilesViewInput): CallTile[] {
  const ownUserId = own?.userId ?? null;
  if (status === "connected") return callTilesFor(liveKit, away, ownUserId);
  if (status !== "away" || own === null) return [];

  return callTilesFor(
    presenceAsParticipants(presence, ownUserId),
    withOwnAwayEntry(away, own),
    ownUserId,
  );
}

export type AwayConfirmation = {
  observe: (roomId: string, entries: AwayEntry[], ownUserId: string) => boolean;
  reset: () => void;
};

export function createAwayConfirmation(): AwayConfirmation {
  const confirmedRooms = new Set<string>();

  return {
    observe(roomId, entries, ownUserId) {
      const absent = ownAwayEnded(confirmedRooms.has(roomId), entries, ownUserId);
      if (absent) confirmedRooms.delete(roomId);
      else if (entries.some((entry) => entry.userId === ownUserId)) confirmedRooms.add(roomId);
      return absent;
    },
    reset: () => confirmedRooms.clear(),
  };
}

export function mergeActivityMessage(current: number, message: unknown, now: number): number {
  if (typeof message !== "object" || message === null) return current;
  const at = (message as { at?: unknown }).at;
  if (typeof at !== "number" || !Number.isFinite(at)) return current;
  return Math.max(current, Math.min(at, now));
}
