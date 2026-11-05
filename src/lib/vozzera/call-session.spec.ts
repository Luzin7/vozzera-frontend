import { describe, expect, it } from "vitest";

import { formatCallDuration } from "@/lib/vozzera/call-duration";
import { applySessionSnapshot, type CallSessions } from "@/lib/vozzera/call-session";
import type { OutboundEvent } from "@/lib/vozzera/types";

type SessionSnapshotEvent = Extract<OutboundEvent, { type: "voice.session.snapshot" }>;

const ROOM_ID = "00000000-0000-4000-8000-000000000001";
const HOUR_MS = 3_600_000;

const snapshot = (overrides: Partial<SessionSnapshotEvent> = {}): SessionSnapshotEvent => ({
  type: "voice.session.snapshot",
  room_id: ROOM_ID,
  started_at: "2026-11-05T10:00:00.000Z",
  server_ts: "2026-11-05T10:30:00.000Z",
  ...overrides,
});

describe("applySessionSnapshot", () => {
  it("corrects a client clock 5 minutes ahead of the server", () => {
    const serverNow = Date.parse("2026-11-05T10:30:00.000Z");
    const clientAhead = serverNow + 5 * 60_000;

    const sessions = applySessionSnapshot({}, snapshot(), clientAhead);

    expect(sessions[ROOM_ID]!).toBe(Date.parse("2026-11-05T10:00:00.000Z") + 5 * 60_000);
    expect(clientAhead - sessions[ROOM_ID]!).toBe(30 * 60_000);
  });

  it("removes the room when started_at is null", () => {
    const current: CallSessions = { [ROOM_ID]: 1, other: 2 };

    expect(applySessionSnapshot(current, snapshot({ started_at: null }), 0)).toEqual({ other: 2 });
  });

  it("returns equal state when the same event is applied twice", () => {
    const receivedAt = Date.parse("2026-11-05T10:30:01.000Z");
    const once = applySessionSnapshot({}, snapshot(), receivedAt);

    expect(applySessionSnapshot(once, snapshot(), receivedAt)).toEqual(once);
  });

  it("shows 1:59:59 to 2:00:00 for a late joiner of a 2h session", () => {
    const serverNow = Date.parse("2026-11-05T12:00:00.000Z");
    const event = snapshot({
      started_at: "2026-11-05T10:00:00.000Z",
      server_ts: "2026-11-05T12:00:00.000Z",
    });

    const sessions = applySessionSnapshot({}, event, serverNow + 40);
    const shown = formatCallDuration(serverNow + 40 + 500 - sessions[ROOM_ID]!);

    expect(["1:59:59", "2:00:00"]).toContain(shown);
    expect(serverNow + 40 - sessions[ROOM_ID]!).toBe(2 * HOUR_MS);
  });
});
