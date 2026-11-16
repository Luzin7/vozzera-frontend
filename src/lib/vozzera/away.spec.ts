import { DisconnectReason } from "livekit-client";
import { describe, expect, it } from "vitest";

import {
  ALONE_LEAVE_MS,
  INACTIVITY_URGENT_WARNING_MS,
  INACTIVITY_WARNING_MS,
  WITH_OTHERS_AWAY_MS,
  ACTIVITY_THROTTLE_MS,
  applyAwaySnapshot,
  AWAY_RESEND_WINDOW_MS,
  MAX_AWAY_RESENDS,
  awayEndedActionFor,
  recentResends,
  callTilesFor,
  callTilesForView,
  createAwayConfirmation,
  endModeFor,
  mergeActivityMessage,
  disconnectRouteFor,
  exitNoticeTextFor,
  inactivityWarningTextFor,
  latestActivityAt,
  shouldRecordActivity,
  inactivityActionAt,
  isConnectionLossReason,
  nextInactivityCheckAt,
  ownAwayEnded,
  sidebarEntriesFor,
} from "@/lib/vozzera/away";
import type { AwayEndedContext, AwayEntry, InactivityInputs } from "@/lib/vozzera/away";

const T0 = 1_000_000;

function inputs(overrides: Partial<InactivityInputs> = {}): InactivityInputs {
  return {
    connected: true,
    alone: false,
    live: false,
    lastActivityAt: T0,
    aloneSince: null,
    ...overrides,
  };
}

function alone(overrides: Partial<InactivityInputs> = {}): InactivityInputs {
  return inputs({ alone: true, aloneSince: T0, ...overrides });
}

describe("inactivityActionAt alone", () => {
  it.each([
    [539_900, null],
    [540_000, "warn"],
    [569_900, "warn"],
    [570_000, "warn-urgent"],
    [599_900, "warn-urgent"],
    [600_000, "leave"],
  ])("at %i ms after the last activity returns %s", (elapsed, expected) => {
    expect(inactivityActionAt(alone(), T0 + elapsed)).toBe(expected);
  });

  it("counts from the moment the user became alone when that is later", () => {
    const state = alone({ aloneSince: T0 + 100_000 });
    expect(inactivityActionAt(state, T0 + 699_900)).toBe("warn-urgent");
    expect(inactivityActionAt(state, T0 + 700_000)).toBe("leave");
  });

  it("counts from the last activity when that is later than aloneSince", () => {
    const state = alone({ lastActivityAt: T0 + 60_000 });
    expect(inactivityActionAt(state, T0 + 659_900)).toBe("warn-urgent");
    expect(inactivityActionAt(state, T0 + 660_000)).toBe("leave");
  });

  it("falls back to the last activity when aloneSince is unknown", () => {
    expect(inactivityActionAt(alone({ aloneSince: null }), T0 + ALONE_LEAVE_MS)).toBe("leave");
  });
});

describe("inactivityActionAt with others", () => {
  it.each([
    [239_900, null],
    [240_000, "warn"],
    [269_900, "warn"],
    [270_000, "warn-urgent"],
    [299_900, "warn-urgent"],
    [300_000, "away"],
  ])("at %i ms after the last activity returns %s", (elapsed, expected) => {
    expect(inactivityActionAt(inputs(), T0 + elapsed)).toBe(expected);
  });

  it("restarts the clock on new activity", () => {
    const state = inputs({ lastActivityAt: T0 + 280_000 });
    expect(inactivityActionAt(state, T0 + 300_000)).toBe(null);
    expect(inactivityActionAt(state, T0 + 280_000 + WITH_OTHERS_AWAY_MS)).toBe("away");
  });

  it("ignores aloneSince", () => {
    expect(inactivityActionAt(inputs({ aloneSince: T0 + 290_000 }), T0 + 300_000)).toBe("away");
  });
});

describe("inactivityActionAt gates", () => {
  it("never acts while a live is running", () => {
    expect(inactivityActionAt(inputs({ live: true }), T0 + 999_999)).toBe(null);
    expect(inactivityActionAt(alone({ live: true }), T0 + 999_999)).toBe(null);
  });

  it("never acts when not connected", () => {
    expect(inactivityActionAt(inputs({ connected: false }), T0 + 999_999)).toBe(null);
  });
});

describe("nextInactivityCheckAt", () => {
  it("points at the warning when nothing is due", () => {
    expect(nextInactivityCheckAt(inputs(), T0)).toBe(
      T0 + WITH_OTHERS_AWAY_MS - INACTIVITY_WARNING_MS,
    );
    expect(nextInactivityCheckAt(alone(), T0)).toBe(T0 + ALONE_LEAVE_MS - INACTIVITY_WARNING_MS);
  });

  it("points at the urgent warning inside the first tier", () => {
    expect(nextInactivityCheckAt(alone(), T0 + 550_000)).toBe(
      T0 + ALONE_LEAVE_MS - INACTIVITY_URGENT_WARNING_MS,
    );
    expect(nextInactivityCheckAt(inputs(), T0 + 250_000)).toBe(
      T0 + WITH_OTHERS_AWAY_MS - INACTIVITY_URGENT_WARNING_MS,
    );
  });

  it("points at the deadline while warning", () => {
    expect(nextInactivityCheckAt(alone(), T0 + 580_000)).toBe(T0 + ALONE_LEAVE_MS);
    expect(nextInactivityCheckAt(inputs(), T0 + 290_000)).toBe(T0 + WITH_OTHERS_AWAY_MS);
  });

  it("returns null once the action is due", () => {
    expect(nextInactivityCheckAt(alone(), T0 + 600_000)).toBe(null);
    expect(nextInactivityCheckAt(inputs(), T0 + 300_000)).toBe(null);
  });

  it("returns null when not connected or live", () => {
    expect(nextInactivityCheckAt(inputs({ connected: false }), T0)).toBe(null);
    expect(nextInactivityCheckAt(inputs({ live: true }), T0)).toBe(null);
  });
});

describe("isConnectionLossReason", () => {
  it.each([
    undefined,
    DisconnectReason.SIGNAL_CLOSE,
    DisconnectReason.JOIN_FAILURE,
    DisconnectReason.UNKNOWN_REASON,
  ])("is true for %s", (reason) => {
    expect(isConnectionLossReason(reason)).toBe(true);
  });

  it.each([
    DisconnectReason.CLIENT_INITIATED,
    DisconnectReason.DUPLICATE_IDENTITY,
    DisconnectReason.PARTICIPANT_REMOVED,
    DisconnectReason.ROOM_DELETED,
    DisconnectReason.ROOM_CLOSED,
  ])("is false for %s", (reason) => {
    expect(isConnectionLossReason(reason)).toBe(false);
  });
});

function away(userId: string, username = userId): AwayEntry {
  return { userId, username, since: "2026-08-13T00:00:00.123456789Z" };
}

describe("applyAwaySnapshot", () => {
  it("replaces the list of the room", () => {
    const previous = { r1: [away("u1")], r2: [away("u2")] };
    const next = applyAwaySnapshot(previous, "r1", [away("u3")]);
    expect(next["r1"]).toEqual([away("u3")]);
    expect(next["r2"]).toBe(previous["r2"]);
  });

  it("removes the room on an empty snapshot", () => {
    expect(applyAwaySnapshot({ r1: [away("u1")] }, "r1", [])).toEqual({});
  });

  it("returns the same state for an identical snapshot", () => {
    const previous = { r1: [away("u1")] };
    expect(applyAwaySnapshot(previous, "r1", [away("u1")])).toBe(previous);
  });

  it("returns the same state for an empty snapshot of an unknown room", () => {
    const previous = { r1: [away("u1")] };
    expect(applyAwaySnapshot(previous, "r2", [])).toBe(previous);
  });

  it("changes the state when only the order differs", () => {
    const previous = { r1: [away("u1"), away("u2")] };
    expect(applyAwaySnapshot(previous, "r1", [away("u2"), away("u1")])).not.toBe(previous);
  });
});

describe("ownAwayEnded", () => {
  it("is false before the tab saw itself away", () => {
    expect(ownAwayEnded(false, [], "me")).toBe(false);
    expect(ownAwayEnded(false, undefined, "me")).toBe(false);
  });

  it("is true once confirmed and absent", () => {
    expect(ownAwayEnded(true, [away("other")], "me")).toBe(true);
    expect(ownAwayEnded(true, [], "me")).toBe(true);
    expect(ownAwayEnded(true, undefined, "me")).toBe(true);
  });

  it("is false while the own entry is present", () => {
    expect(ownAwayEnded(true, [away("me")], "me")).toBe(false);
  });
});

describe("callTilesFor", () => {
  const liveKit = [
    { identity: "me", name: "Eu", isLocal: true },
    { identity: "u2", name: "Bia", isLocal: false },
  ];

  it("marks LiveKit participants as present", () => {
    expect(callTilesFor(liveKit, [], "me")).toEqual([
      { identity: "me", name: "Eu", isLocal: true, isAway: false },
      { identity: "u2", name: "Bia", isLocal: false, isAway: false },
    ]);
  });

  it("appends away entries in server order", () => {
    const tiles = callTilesFor(liveKit, [away("u4", "Dan"), away("u3", "Cris")], "me");
    expect(tiles.slice(2)).toEqual([
      { identity: "u4", name: "Dan", isLocal: false, isAway: true },
      { identity: "u3", name: "Cris", isLocal: false, isAway: true },
    ]);
  });

  it("lets LiveKit win over an away entry of the same user", () => {
    const tiles = callTilesFor(liveKit, [away("u2", "Bia")], "me");
    expect(tiles).toHaveLength(2);
    expect(tiles[1]?.isAway).toBe(false);
  });

  it("marks the own away tile as local", () => {
    expect(callTilesFor([], [away("me", "Eu")], "me")).toEqual([
      { identity: "me", name: "Eu", isLocal: true, isAway: true },
    ]);
  });

  it("never marks an away tile local without a local identity", () => {
    expect(callTilesFor([], [away("me")], null)[0]?.isLocal).toBe(false);
  });
});

describe("sidebarEntriesFor", () => {
  const present = [{ sid: "s1", user_id: "u1", username: "Luan" }];

  it("lists present users then away users", () => {
    expect(sidebarEntriesFor(present, [away("u2", "Bia")])).toEqual([
      { userId: "u1", username: "Luan", isAway: false },
      { userId: "u2", username: "Bia", isAway: true },
    ]);
  });

  it("lets presence win over an away entry of the same user", () => {
    expect(sidebarEntriesFor(present, [away("u1", "Luan")])).toEqual([
      { userId: "u1", username: "Luan", isAway: false },
    ]);
  });
});

describe("disconnectRouteFor", () => {
  it("routes a connection loss with remote participants to away", () => {
    expect(disconnectRouteFor(DisconnectReason.SIGNAL_CLOSE, 1)).toBe("away");
    expect(disconnectRouteFor(undefined, 3)).toBe("away");
  });

  it("routes a connection loss while alone to a full exit", () => {
    expect(disconnectRouteFor(DisconnectReason.SIGNAL_CLOSE, 0)).toBe("exit");
    expect(disconnectRouteFor(undefined, 0)).toBe("exit");
  });

  it.each([
    DisconnectReason.CLIENT_INITIATED,
    DisconnectReason.DUPLICATE_IDENTITY,
    DisconnectReason.PARTICIPANT_REMOVED,
    DisconnectReason.ROOM_DELETED,
    DisconnectReason.ROOM_CLOSED,
  ])("keeps the default behavior for reason %s", (reason) => {
    expect(disconnectRouteFor(reason, 2)).toBe("default");
    expect(disconnectRouteFor(reason, 0)).toBe("default");
  });
});

describe("awayEndedActionFor", () => {
  const intent = { roomId: "r1", reason: "idle" as const };
  const ended = (overrides: Partial<{ roomId: string; userId: string; reason: string }> = {}) => ({
    roomId: "r1",
    userId: "me",
    reason: "room_empty",
    ...overrides,
  });
  const context = (overrides: Partial<AwayEndedContext> = {}): AwayEndedContext => ({
    awayPresence: {},
    voicePresence: {},
    resendTimes: [],
    now: 1_000_000,
    ...overrides,
  });

  it("ends the away on an own room_empty", () => {
    expect(awayEndedActionFor(ended({ reason: "room_empty" }), "me", intent, context())).toBe(
      "end",
    );
  });

  it.each(["connection_closed", "snapshot_absent"])("re-sends on an own %s", (reason) => {
    expect(awayEndedActionFor(ended({ reason }), "me", intent, context())).toBe("resend");
  });

  it("ends quietly on an own returned", () => {
    expect(awayEndedActionFor(ended({ reason: "returned" }), "me", intent, context())).toBe(
      "end_quiet",
    );
  });

  it("ignores other users", () => {
    expect(awayEndedActionFor(ended({ userId: "u2" }), "me", intent, context())).toBe("ignore");
  });

  it("ignores events while no intent is set", () => {
    expect(awayEndedActionFor(ended(), "me", null, context())).toBe("ignore");
  });

  it("ignores events of a room other than the intent room", () => {
    const other = ended({ roomId: "r2", reason: "snapshot_absent" });
    expect(awayEndedActionFor(other, "me", intent, context())).toBe("ignore");
    expect(awayEndedActionFor(ended({ roomId: "r2" }), "me", intent, context())).toBe("ignore");
  });

  it("ignores everything without an own user id", () => {
    expect(awayEndedActionFor(ended(), null, intent, context())).toBe("ignore");
  });

  it.each(["connection_closed", "snapshot_absent"])(
    "ends quietly on %s when the own entry is away in another room",
    (reason) => {
      const awayPresence = { r2: [away("me")] };
      expect(awayEndedActionFor(ended({ reason }), "me", intent, context({ awayPresence }))).toBe(
        "end_quiet",
      );
    },
  );

  it("ends quietly when the user is connected to voice in another room", () => {
    const voicePresence = { r2: [{ sid: "s", user_id: "me", username: "Eu" }] };
    const action = awayEndedActionFor(
      ended({ reason: "snapshot_absent" }),
      "me",
      intent,
      context({ voicePresence }),
    );
    expect(action).toBe("end_quiet");
  });

  it("still re-sends when the lingering voice presence is in the intent room", () => {
    const voicePresence = { r1: [{ sid: "s", user_id: "me", username: "Eu" }] };
    const action = awayEndedActionFor(
      ended({ reason: "snapshot_absent" }),
      "me",
      intent,
      context({ voicePresence }),
    );
    expect(action).toBe("resend");
  });

  it("stops re-sending after the cap inside the window", () => {
    const now = 1_000_000;
    const resendTimes = Array.from({ length: MAX_AWAY_RESENDS }, (_, i) => now - i * 1000);
    expect(
      awayEndedActionFor(
        ended({ reason: "snapshot_absent" }),
        "me",
        intent,
        context({ resendTimes, now }),
      ),
    ).toBe("end");
  });

  it("re-sends again once old attempts left the window", () => {
    const now = 1_000_000;
    const resendTimes = Array.from({ length: MAX_AWAY_RESENDS }, () => now - AWAY_RESEND_WINDOW_MS);
    expect(
      awayEndedActionFor(
        ended({ reason: "snapshot_absent" }),
        "me",
        intent,
        context({ resendTimes, now }),
      ),
    ).toBe("resend");
  });
});

describe("endModeFor", () => {
  const now = 1_000_000;

  it("drops the intent when this tab never re-sent", () => {
    expect(endModeFor([], now)).toBe("drop");
  });

  it("drops the intent when the re-sends left the window", () => {
    expect(endModeFor([now - AWAY_RESEND_WINDOW_MS], now)).toBe("drop");
  });

  it("sends leave after a recent re-send", () => {
    expect(endModeFor([now - 1000], now)).toBe("leave");
  });

  it("sends leave once the cap was reached", () => {
    const times = Array.from({ length: MAX_AWAY_RESENDS }, (_, i) => now - i * 1000);
    expect(endModeFor(times, now)).toBe("leave");
  });
});

describe("recentResends", () => {
  it("keeps only the attempts inside the window", () => {
    const now = 100_000;
    expect(recentResends([now - AWAY_RESEND_WINDOW_MS - 1, now - 1, now], now)).toEqual([
      now - 1,
      now,
    ]);
  });
});

describe("latestActivityAt", () => {
  it("returns the most recent moment", () => {
    expect(latestActivityAt([10, 50, 20])).toBe(50);
  });

  it("skips missing moments", () => {
    expect(latestActivityAt([null, 7, undefined])).toBe(7);
  });

  it("returns 0 when nothing happened", () => {
    expect(latestActivityAt([null])).toBe(0);
  });
});

describe("shouldRecordActivity", () => {
  it("records the first event", () => {
    expect(shouldRecordActivity(null, 5)).toBe(true);
  });

  it("throttles events inside the window", () => {
    expect(shouldRecordActivity(1000, 1000 + ACTIVITY_THROTTLE_MS - 1)).toBe(false);
  });

  it("records again once the window passed", () => {
    expect(shouldRecordActivity(1000, 1000 + ACTIVITY_THROTTLE_MS)).toBe(true);
  });
});

describe("copy", () => {
  it("warns about leaving when alone and about being away otherwise", () => {
    expect(inactivityWarningTextFor(true, "warn")).toBe(
      "Você vai sair da call em 60 segundos por inatividade.",
    );
    expect(inactivityWarningTextFor(false, "warn")).toBe(
      "Você vai ficar ausente em 60 segundos por inatividade.",
    );
  });

  it("shortens the countdown on the urgent tier", () => {
    expect(inactivityWarningTextFor(true, "warn-urgent")).toBe(
      "Você vai sair da call em 30 segundos por inatividade.",
    );
    expect(inactivityWarningTextFor(false, "warn-urgent")).toBe(
      "Você vai ficar ausente em 30 segundos por inatividade.",
    );
  });

  it("maps exit reasons to the notice text", () => {
    expect(exitNoticeTextFor("inactivity")).toBe("Você saiu da call por inatividade");
    expect(exitNoticeTextFor("room_empty")).toBe("Você saiu da call por inatividade");
    expect(exitNoticeTextFor("connection")).toBe("A conexão de voz caiu.");
  });
});

describe("callTilesForView", () => {
  const own = { userId: "me", username: "Eu" };
  const liveKit = [
    { identity: "me", name: "Eu", isLocal: true },
    { identity: "u2", name: "Bia", isLocal: false },
  ];
  const presence = [
    { sid: "s1", user_id: "me", username: "Eu" },
    { sid: "s2", user_id: "u2", username: "Bia" },
  ];

  it("uses the LiveKit participants plus away entries while connected", () => {
    const tiles = callTilesForView({
      status: "connected",
      liveKit,
      presence,
      away: [away("u3", "Cris")],
      own,
    });
    expect(tiles.map((t) => [t.identity, t.isAway])).toEqual([
      ["me", false],
      ["u2", false],
      ["u3", true],
    ]);
  });

  it("builds tiles from the WS presence while away, with the own tile away", () => {
    const tiles = callTilesForView({
      status: "away",
      liveKit: [],
      presence,
      away: [away("u3", "Cris")],
      own,
    });
    expect(tiles).toEqual([
      { identity: "u2", name: "Bia", isLocal: false, isAway: false },
      { identity: "u3", name: "Cris", isLocal: false, isAway: true },
      { identity: "me", name: "Eu", isLocal: true, isAway: true },
    ]);
  });

  it("does not duplicate the own tile once the server confirmed it", () => {
    const tiles = callTilesForView({
      status: "away",
      liveKit: [],
      presence: [presence[1]!],
      away: [away("me", "Eu")],
      own,
    });
    expect(tiles.filter((t) => t.identity === "me")).toHaveLength(1);
    expect(tiles.find((t) => t.identity === "me")?.isLocal).toBe(true);
  });

  it("shows only the own away tile when nobody else is listed", () => {
    const tiles = callTilesForView({ status: "away", liveKit: [], presence: [], away: [], own });
    expect(tiles).toEqual([{ identity: "me", name: "Eu", isLocal: true, isAway: true }]);
  });

  it("shows no tiles when idle", () => {
    expect(callTilesForView({ status: "idle", liveKit: [], presence: [], away: [], own })).toEqual(
      [],
    );
  });
});

describe("createAwayConfirmation", () => {
  it("reports the own absence only after the own entry was seen", () => {
    const confirmation = createAwayConfirmation();
    expect(confirmation.observe("r1", [], "me")).toBe(false);
    expect(confirmation.observe("r1", [away("me")], "me")).toBe(false);
    expect(confirmation.observe("r1", [], "me")).toBe(true);
    expect(confirmation.observe("r1", [], "me")).toBe(false);
  });

  it("tracks rooms independently", () => {
    const confirmation = createAwayConfirmation();
    confirmation.observe("r1", [away("me")], "me");
    expect(confirmation.observe("r2", [], "me")).toBe(false);
  });

  it("forgets every confirmation on reset", () => {
    const confirmation = createAwayConfirmation();
    confirmation.observe("r1", [away("me")], "me");
    confirmation.reset();
    expect(confirmation.observe("r1", [], "me")).toBe(false);
  });
});

describe("away loss scenarios", () => {
  const intent = { roomId: "r1", reason: "idle" as const };
  const event = (reason: string) => ({ roomId: "r1", userId: "B", reason });
  const context: AwayEndedContext = {
    awayPresence: {},
    voicePresence: {},
    resendTimes: [],
    now: 1_000_000,
  };

  it("keeps B away after a resync when the first snapshot lists only A", () => {
    const confirmation = createAwayConfirmation();
    confirmation.observe("r1", [away("A"), away("B")], "B");
    confirmation.reset();

    const absent = confirmation.observe("r1", [away("A")], "B");

    expect(absent).toBe(false);
    expect(awayEndedActionFor(event("snapshot_absent"), "B", intent, context)).not.toBe("end");
  });

  it("re-sends, and does not end, when a snapshot drops B before ended connection_closed", () => {
    const confirmation = createAwayConfirmation();
    confirmation.observe("r1", [away("A"), away("B")], "B");

    expect(confirmation.observe("r1", [away("A")], "B")).toBe(true);
    expect(awayEndedActionFor(event("snapshot_absent"), "B", intent, context)).toBe("resend");
    expect(awayEndedActionFor(event("connection_closed"), "B", intent, context)).toBe("resend");
  });

  it("ends when the server rejects the re-enter with room_empty", () => {
    expect(awayEndedActionFor(event("room_empty"), "B", intent, context)).toBe("end");
  });

  it("stops the R/S ping-pong of one user away in two tabs", () => {
    const tabInR = { roomId: "R", reason: "idle" as const };
    const movedToS = { awayPresence: { S: [away("me")] } };
    const action = awayEndedActionFor(
      { roomId: "R", userId: "me", reason: "snapshot_absent" },
      "me",
      tabInR,
      { ...context, ...movedToS },
    );
    expect(action).toBe("end_quiet");
  });

  it("stops after three re-sends within a minute", () => {
    const now = 1_000_000;
    const times: number[] = [];
    const actions: string[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const at = now + attempt * 1000;
      const action = awayEndedActionFor(event("snapshot_absent"), "B", intent, {
        ...context,
        resendTimes: recentResends(times, at),
        now: at,
      });
      actions.push(action);
      if (action === "resend") times.push(at);
    }
    expect(actions).toEqual(["resend", "resend", "resend", "end"]);
  });
});

describe("mergeActivityMessage", () => {
  it("keeps the latest moment", () => {
    expect(mergeActivityMessage(100, { at: 250 }, 1000)).toBe(250);
    expect(mergeActivityMessage(300, { at: 250 }, 1000)).toBe(300);
  });

  it("clamps future timestamps to now", () => {
    expect(mergeActivityMessage(100, { at: 9_999_999 }, 1000)).toBe(1000);
  });

  it.each([null, undefined, "x", 5, {}, { at: "250" }, { at: Number.NaN }])(
    "ignores the malformed message %j",
    (message) => {
      expect(mergeActivityMessage(100, message, 1000)).toBe(100);
    },
  );
});
