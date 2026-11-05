import type { OutboundEvent } from "@/lib/vozzera/types";

export type CallSessions = Record<string, number>;

type SessionSnapshotEvent = Extract<OutboundEvent, { type: "voice.session.snapshot" }>;

export function applySessionSnapshot(
  sessions: CallSessions,
  event: SessionSnapshotEvent,
  receivedAt: number,
): CallSessions {
  if (event.started_at === null) {
    const { [event.room_id]: _ended, ...remaining } = sessions;
    return remaining;
  }

  const clockSkewMs = receivedAt - Date.parse(event.server_ts);
  return { ...sessions, [event.room_id]: Date.parse(event.started_at) + clockSkewMs };
}
