import { describe, expect, it, vi } from "vitest";

import {
  createLiveEditTracker,
  diffRoomSubscriptions,
  historyFailureStatus,
  markHistoryStatus,
  markStaleRooms,
  mergeHistory,
  mergeOlderPage,
  canLoadOlder,
  loadOlderPage,
  shouldApplyOlderPage,
  patchOlderHistory,
  seedOlderHistory,
  needsHistory,
  refetchHistoryStaggered,
  MAX_RECENT_REFETCH_ROOMS,
  rememberRecentRoom,
  roomsToRefetch,
  shouldRefetchAfterStatus,
} from "@/lib/vozzera/chat-history";
import type { HistoryStatuses, OlderHistories, OlderHistory } from "@/lib/vozzera/chat-history";
import type { ChatMessage } from "@/lib/vozzera/types";

function message(id: string, createdAt: string, content = "oi"): ChatMessage {
  return {
    id,
    roomId: "r1",
    userId: "u1",
    username: "luan",
    content,
    createdAt,
    updatedAt: "",
    replyTo: null,
  };
}

describe("mergeHistory", () => {
  it("keeps live messages that history does not know", () => {
    const live = [message("c", "2026-08-13T10:02:00Z")];
    const history = [message("a", "2026-08-13T10:00:00Z"), message("b", "2026-08-13T10:01:00Z")];
    expect(mergeHistory(live, history).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("dedupes by id and prefers the fetched copy", () => {
    const live = [message("a", "2026-08-13T10:00:00Z", "velho")];
    const history = [message("a", "2026-08-13T10:00:00Z", "editado")];
    expect(mergeHistory(live, history)).toEqual(history);
  });

  it("places an older live-only message before the fetched ones", () => {
    const merged = mergeHistory(
      [message("m", "2026-08-13T09:00:00Z")],
      [message("b", "2026-08-13T10:00:00Z")],
    );
    expect(merged.map((m) => m.id)).toEqual(["m", "b"]);
  });

  it("returns an empty list for empty inputs", () => {
    expect(mergeHistory([], [])).toEqual([]);
  });

  it("does not resurrect a message deleted live while the fetch was in flight", () => {
    const history = [message("a", "2026-08-13T10:00:00Z"), message("b", "2026-08-13T10:01:00Z")];
    const merged = mergeHistory([], history, { deletedIds: new Set(["a"]) });
    expect(merged.map((m) => m.id)).toEqual(["b"]);
  });

  it("applies an edit made while offline, with real wire precisions", () => {
    const live = [message("a1", "2026-11-05T10:00:00.123456Z", "velho")];
    const history = [message("a1", "2026-11-05T10:00:00Z", "editado offline")];
    const merged = mergeHistory(live, history, { knownBeforeFetch: new Set(["a1"]), pageSize: 50 });
    expect(merged[0]?.content).toBe("editado offline");
  });

  it("keeps the live edit received after the fetch started", () => {
    const live = [message("a", "2026-11-05T10:00:00.5Z", "novo")];
    const history = [message("a", "2026-11-05T10:00:00Z", "velho")];
    const merged = mergeHistory(live, history, { editedDuringFetchIds: new Set(["a"]) });
    expect(merged[0]?.content).toBe("novo");
  });

  it("keeps the server order for messages in the same second", () => {
    const history = [
      message("f0000000-0000-4000-8000-000000000000", "2026-11-05T10:00:00Z", "primeira"),
      message("00000000-0000-4000-8000-000000000000", "2026-11-05T10:00:00Z", "segunda"),
    ];
    expect(mergeHistory([], history, { pageSize: 50 }).map((m) => m.content)).toEqual([
      "primeira",
      "segunda",
    ]);
  });

  it("places live-only messages by second without reordering fetched ones", () => {
    const history = [
      message("z", "2026-11-05T10:00:01Z", "h1"),
      message("a", "2026-11-05T10:00:01Z", "h2"),
      message("m", "2026-11-05T10:00:03Z", "h3"),
    ];
    const live = [
      message("l1", "2026-11-05T10:00:02.250000Z", "l1"),
      message("l2", "2026-11-05T10:00:09.100000Z", "l2"),
    ];
    expect(mergeHistory(live, history).map((m) => m.content)).toEqual([
      "h1",
      "h2",
      "l1",
      "h3",
      "l2",
    ]);
  });

  it("keeps a local message in the same second as the oldest fetched of a full page", () => {
    const history = Array.from({ length: 50 }, (_, i) =>
      message(`h${i}`, `2026-11-05T10:00:${String(i).padStart(2, "0")}Z`),
    );
    const local = [message("older", "2026-11-05T10:00:00.400Z")];
    const merged = mergeHistory(local, history, {
      knownBeforeFetch: new Set(["older"]),
      pageSize: 50,
    });
    expect(merged.some((m) => m.id === "older")).toBe(true);
  });

  it("drops local messages deleted server-side inside the fetched window", () => {
    const current = [
      message("a", "2026-08-13T10:00:00Z"),
      message("gone", "2026-08-13T10:01:00Z"),
      message("c", "2026-08-13T10:02:00Z"),
    ];
    const history = [message("a", "2026-08-13T10:00:00Z"), message("c", "2026-08-13T10:02:00Z")];
    const merged = mergeHistory(current, history, {
      knownBeforeFetch: new Set(["a", "gone", "c"]),
    });
    expect(merged.map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("keeps messages created live after the fetch started", () => {
    const current = [message("a", "2026-08-13T10:00:00Z"), message("new", "2026-08-13T10:03:00Z")];
    const history = [message("a", "2026-08-13T10:00:00Z")];
    const merged = mergeHistory(current, history, { knownBeforeFetch: new Set(["a"]) });
    expect(merged.map((m) => m.id)).toEqual(["a", "new"]);
  });

  it("keeps local messages older than a full fetched page", () => {
    const current = [message("old", "2026-08-13T08:00:00Z"), message("a", "2026-08-13T10:00:00Z")];
    const history = [message("a", "2026-08-13T10:00:00Z")];
    const merged = mergeHistory(current, history, {
      knownBeforeFetch: new Set(["old", "a"]),
      pageSize: 1,
    });
    expect(merged.map((m) => m.id)).toEqual(["old", "a"]);
  });
});

describe("history status", () => {
  it("needs history when unknown or failed, not while loading or loaded", () => {
    const statuses: HistoryStatuses = { a: "loading", b: "loaded", c: "failed" };
    expect(needsHistory(statuses, "a")).toBe(false);
    expect(needsHistory(statuses, "b")).toBe(false);
    expect(needsHistory(statuses, "c")).toBe(true);
    expect(needsHistory(statuses, "unknown")).toBe(true);
    expect(needsHistory({ ...statuses, s: "stale" }, "s")).toBe(true);
  });

  it("marks as stale only loaded rooms that were not refetched", () => {
    const statuses: HistoryStatuses = { a: "loaded", b: "loaded", c: "failed", d: "loading" };
    expect(markStaleRooms(statuses, ["a"])).toEqual({
      a: "loaded",
      b: "stale",
      c: "failed",
      d: "loading",
    });
  });

  it("marks a status without mutating", () => {
    const statuses: HistoryStatuses = { a: "loading" };
    expect(markHistoryStatus(statuses, "a", "loaded")).toEqual({ a: "loaded" });
    expect(statuses).toEqual({ a: "loading" });
  });

  it("refetches only rooms whose history was loaded and still exist", () => {
    const statuses: HistoryStatuses = { a: "loaded", b: "failed", c: "loading", d: "loaded" };
    expect(
      roomsToRefetch(statuses, ["a", "b", "c", "e"], { activeRoomId: "a", recentRoomIds: [] }),
    ).toEqual(["a"]);
  });

  it("caps the refetch to the active room plus the most recently opened ones", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const statuses: HistoryStatuses = Object.fromEntries(ids.map((id) => [id, "loaded" as const]));
    const result = roomsToRefetch(statuses, ids, {
      activeRoomId: "g",
      recentRoomIds: ["f", "e", "d", "c", "b", "a"],
    });
    expect(result).toEqual(["g", "f", "e", "d", "c"]);
    expect(result).toHaveLength(MAX_RECENT_REFETCH_ROOMS + 1);
  });

  it("remembers recent rooms most recent first without duplicates", () => {
    expect(rememberRecentRoom(["a", "b"], "b")).toEqual(["b", "a"]);
    expect(rememberRecentRoom(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });
});

describe("shouldRefetchAfterStatus", () => {
  it("refetches only when the socket reopens after having been open", () => {
    expect(shouldRefetchAfterStatus({ hasOpenedBefore: false, status: "open" })).toBe(false);
    expect(shouldRefetchAfterStatus({ hasOpenedBefore: true, status: "connecting" })).toBe(false);
    expect(shouldRefetchAfterStatus({ hasOpenedBefore: true, status: "closed" })).toBe(false);
    expect(shouldRefetchAfterStatus({ hasOpenedBefore: true, status: "open" })).toBe(true);
  });
});

describe("refetchHistoryStaggered", () => {
  it("fetches rooms one at a time with a wait between them", async () => {
    const calls: string[] = [];
    const wait = vi.fn(async () => {
      calls.push("wait");
    });
    await refetchHistoryStaggered({
      roomIds: ["a", "b", "c"],
      fetchRoom: async (roomId) => {
        calls.push(roomId);
      },
      onError: vi.fn(),
      wait,
      delayMs: 250,
    });
    expect(calls).toEqual(["a", "wait", "b", "wait", "c"]);
    expect(wait).toHaveBeenCalledWith(250);
  });

  it("tries each room once, reports the failure with the room id and continues", async () => {
    const fetchRoom = vi.fn(async (roomId: string) => {
      if (roomId === "a") throw new Error("boom");
    });
    const onError = vi.fn();
    await refetchHistoryStaggered({
      roomIds: ["a", "b"],
      fetchRoom,
      onError,
      wait: async () => {},
      delayMs: 0,
    });
    expect(fetchRoom).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("a", expect.any(Error));
  });

  it("does nothing without rooms", async () => {
    const fetchRoom = vi.fn();
    await refetchHistoryStaggered({
      roomIds: [],
      fetchRoom,
      onError: vi.fn(),
      wait: async () => {},
      delayMs: 0,
    });
    expect(fetchRoom).not.toHaveBeenCalled();
  });

  it("stops when cancelled", async () => {
    const fetchRoom = vi.fn(async () => {});
    let cancelled = false;
    await refetchHistoryStaggered({
      roomIds: ["a", "b"],
      fetchRoom,
      onError: vi.fn(),
      wait: async () => {
        cancelled = true;
      },
      delayMs: 0,
      isCancelled: () => cancelled,
    });
    expect(fetchRoom).toHaveBeenCalledTimes(1);
  });
});

describe("diffRoomSubscriptions", () => {
  it("subscribes new rooms and unsubscribes removed ones", () => {
    expect(diffRoomSubscriptions(new Set(["a", "b"]), ["b", "c"])).toEqual({
      toSubscribe: ["b", "c"],
      toUnsubscribe: ["a"],
    });
  });
});

describe("createLiveEditTracker", () => {
  it("reports only edits made after the checkpoint", () => {
    const tracker = createLiveEditTracker();
    tracker.markEdited("before");
    const checkpoint = tracker.checkpoint();
    tracker.markEdited("after");
    expect(tracker.editedSince(checkpoint)).toEqual(new Set(["after"]));
  });
});

describe("historyFailureStatus", () => {
  it("marks the active room failed and the others stale", () => {
    expect(historyFailureStatus("a", "a")).toBe("failed");
    expect(historyFailureStatus("b", "a")).toBe("stale");
    expect(historyFailureStatus("b", null)).toBe("stale");
  });
});

describe("mergeOlderPage", () => {
  const T = (sec: number) => `2026-01-01T00:00:${String(sec).padStart(2, "0")}Z`;

  it("prepends the older page keeping every newer local message", () => {
    const current = [message("c", T(30)), message("d", T(40)), message("live", T(55))];
    const page = [message("a", T(10)), message("b", T(20))];

    const merged = mergeOlderPage(current, page);

    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c", "d", "live"]);
  });

  it("does not drop newer messages even when the page is full", () => {
    const current = [message("c", T(30)), message("d", T(40))];
    const page = Array.from({ length: 50 }, (_, i) => message(`o${i}`, T(i % 20)));

    const merged = mergeOlderPage(current, page);

    expect(merged.map((m) => m.id).slice(-2)).toEqual(["c", "d"]);
    expect(merged).toHaveLength(52);
  });

  it("dedupes by id keeping the local copy", () => {
    const current = [message("b", T(20), "editado"), message("c", T(30))];
    const page = [message("a", T(10)), message("b", T(20), "antigo")];

    const merged = mergeOlderPage(current, page);

    expect(merged.map((m) => [m.id, m.content])).toEqual([
      ["a", "oi"],
      ["b", "editado"],
      ["c", "oi"],
    ]);
  });

  it("keeps same-second order: older page first, then current", () => {
    const current = [message("c1", T(20)), message("c2", T(20))];
    const page = [message("p1", T(20)), message("p2", T(20))];

    const merged = mergeOlderPage(current, page);

    expect(merged.map((m) => m.id)).toEqual(["p1", "p2", "c1", "c2"]);
  });

  it("skips messages deleted while the page was in flight", () => {
    const merged = mergeOlderPage(
      [message("c", T(30))],
      [message("a", T(10)), message("b", T(20))],
      {
        deletedIds: new Set(["a"]),
      },
    );

    expect(merged.map((m) => m.id)).toEqual(["b", "c"]);
  });

  it("returns the current list for an empty page", () => {
    const current = [message("c", T(30))];

    expect(mergeOlderPage(current, [])).toEqual(current);
  });
});

describe("older history state", () => {
  it("seeds only once so a refetch keeps the older cursor", () => {
    const seeded = seedOlderHistory({}, "r1", "c1");

    expect(seedOlderHistory(seeded, "r1", "c-latest")).toBe(seeded);
  });

  it("allows loading while a cursor exists and nothing is loading", () => {
    expect(canLoadOlder(seedOlderHistory({}, "r1", "c1"), "r1")).toBe(true);
  });

  it("blocks a duplicate load while loading", () => {
    const loading = patchOlderHistory(seedOlderHistory({}, "r1", "c1"), "r1", { loading: true });

    expect(canLoadOlder(loading, "r1")).toBe(false);
  });

  it("marks end of history when there is no cursor", () => {
    expect(canLoadOlder(seedOlderHistory({}, "r1", null), "r1")).toBe(false);
  });

  it("allows retry after a failure keeping the cursor", () => {
    const failed = patchOlderHistory(seedOlderHistory({}, "r1", "c1"), "r1", {
      loading: false,
      failed: true,
    });

    expect(canLoadOlder(failed, "r1")).toBe(true);
  });
});

describe("shouldApplyOlderPage", () => {
  const seeded = seedOlderHistory({}, "r1", "c1");

  it("applies when the cursor is unchanged", () => {
    expect(shouldApplyOlderPage(seeded, "r1", "c1")).toBe(true);
  });

  it("ignores when the room state was cleared in flight", () => {
    expect(shouldApplyOlderPage({}, "r1", "c1")).toBe(false);
  });

  it("ignores when the cursor changed in flight", () => {
    expect(shouldApplyOlderPage(seedOlderHistory({}, "r1", "c2"), "r1", "c1")).toBe(false);
  });
});

describe("loadOlderPage", () => {
  const page = {
    messages: [
      {
        id: "a",
        content: "oi",
        created_at: "2026-01-01T00:00:10Z",
        user_id: "u1",
        username: "luan",
      },
    ],
    nextBefore: "c0" as string | null,
  };

  function setup(initial: OlderHistories) {
    const state = { histories: initial };
    const deps = {
      roomId: "r1",
      getHistories: () => state.histories,
      fetchPage: vi.fn(async (_cursor: string) => page),
      commit: vi.fn((roomId: string, patch: Partial<OlderHistory>) => {
        state.histories = patchOlderHistory(state.histories, roomId, patch);
      }),
      applyPage: vi.fn(),
      onUnauthorized: vi.fn(),
      onFailure: vi.fn(),
      isUnauthorizedError: (error: unknown): boolean => error === "401",
    };
    return { state, deps };
  }

  it("fetches with the cursor, applies the page and stores the next cursor", async () => {
    const { state, deps } = setup(seedOlderHistory({}, "r1", "c1"));

    await loadOlderPage(deps);

    expect(deps.fetchPage).toHaveBeenCalledWith("c1");
    expect(deps.applyPage).toHaveBeenCalledWith(page);
    expect(state.histories["r1"]).toEqual({ nextBefore: "c0", loading: false, failed: false });
  });

  it("does not fetch while already loading", async () => {
    const loading = patchOlderHistory(seedOlderHistory({}, "r1", "c1"), "r1", { loading: true });
    const { deps } = setup(loading);

    await loadOlderPage(deps);

    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it("does not fetch at the end of history", async () => {
    const { deps } = setup(seedOlderHistory({}, "r1", null));

    await loadOlderPage(deps);

    expect(deps.fetchPage).not.toHaveBeenCalled();
  });

  it("marks failure, notifies and allows retry with the same cursor", async () => {
    const { state, deps } = setup(seedOlderHistory({}, "r1", "c1"));
    deps.fetchPage.mockRejectedValueOnce(new Error("timeout"));

    await loadOlderPage(deps);

    expect(deps.onFailure).toHaveBeenCalledTimes(1);
    expect(state.histories["r1"]).toEqual({ nextBefore: "c1", loading: false, failed: true });
    expect(canLoadOlder(state.histories, "r1")).toBe(true);
  });

  it("signals unauthorized instead of a failure toast", async () => {
    const { deps } = setup(seedOlderHistory({}, "r1", "c1"));
    deps.fetchPage.mockRejectedValueOnce("401");

    await loadOlderPage(deps);

    expect(deps.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it("ignores a late page after the room state was cleared", async () => {
    const { state, deps } = setup(seedOlderHistory({}, "r1", "c1"));
    deps.fetchPage.mockImplementationOnce(async () => {
      state.histories = {};
      return page;
    });

    await loadOlderPage(deps);

    expect(deps.applyPage).not.toHaveBeenCalled();
    expect(state.histories).toEqual({});
  });

  it("ignores a late failure after the room state was cleared", async () => {
    const { state, deps } = setup(seedOlderHistory({}, "r1", "c1"));
    deps.fetchPage.mockImplementationOnce(async () => {
      state.histories = {};
      throw new Error("late");
    });

    await loadOlderPage(deps);

    expect(deps.onFailure).not.toHaveBeenCalled();
    expect(state.histories).toEqual({});
  });

  it("ignores a late page when the cursor was replaced", async () => {
    const { state, deps } = setup(seedOlderHistory({}, "r1", "c1"));
    deps.fetchPage.mockImplementationOnce(async () => {
      state.histories = seedOlderHistory({}, "r1", "new");
      return page;
    });

    await loadOlderPage(deps);

    expect(deps.applyPage).not.toHaveBeenCalled();
    expect(state.histories["r1"]?.nextBefore).toBe("new");
  });
});
