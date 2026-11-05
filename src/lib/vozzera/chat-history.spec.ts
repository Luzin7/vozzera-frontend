import { describe, expect, it, vi } from "vitest";

import {
  createLiveEditTracker,
  diffRoomSubscriptions,
  historyFailureStatus,
  markHistoryStatus,
  markStaleRooms,
  mergeHistory,
  needsHistory,
  refetchHistoryStaggered,
  MAX_RECENT_REFETCH_ROOMS,
  rememberRecentRoom,
  roomsToRefetch,
  shouldRefetchAfterStatus,
} from "@/lib/vozzera/chat-history";
import type { HistoryStatuses } from "@/lib/vozzera/chat-history";
import type { ChatMessage } from "@/lib/vozzera/types";

function message(id: string, createdAt: string, content = "oi"): ChatMessage {
  return { id, roomId: "r1", userId: "u1", username: "luan", content, createdAt, updatedAt: "" };
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
