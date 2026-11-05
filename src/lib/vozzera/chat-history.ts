import type { SocketStatus } from "@/lib/vozzera/useSocket";
import type { ChatMessage, HistoryMessage } from "@/lib/vozzera/types";

export type HistoryStatus = "loading" | "loaded" | "stale" | "failed";
export type HistoryStatuses = Record<string, HistoryStatus>;

export const HISTORY_REFETCH_DELAY_MS = 1000;
export const MAX_RECENT_REFETCH_ROOMS = 4;

function secondOf(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

type MergeOptions = {
  deletedIds?: ReadonlySet<string>;
  editedDuringFetchIds?: ReadonlySet<string>;
  knownBeforeFetch?: ReadonlySet<string>;
  pageSize?: number;
};

function fetchedWindowStartSecond(history: ChatMessage[], pageSize: number | undefined): number {
  if (pageSize === undefined || history.length < pageSize) return Number.NEGATIVE_INFINITY;
  return Math.min(...history.map((message) => secondOf(message.createdAt)));
}

function wasRemovedServerSide(
  message: ChatMessage,
  options: MergeOptions,
  windowStartSecond: number,
): boolean {
  if (!options.knownBeforeFetch?.has(message.id)) return false;
  return secondOf(message.createdAt) > windowStartSecond;
}

function mergeBySecond(fetched: ChatMessage[], liveOnly: ChatMessage[]): ChatMessage[] {
  const sortedLive = liveOnly
    .map((message, index) => ({ message, index }))
    .sort(
      (a, b) => secondOf(a.message.createdAt) - secondOf(b.message.createdAt) || a.index - b.index,
    )
    .map(({ message }) => message);
  const merged: ChatMessage[] = [];
  let fetchedIndex = 0;

  for (const live of sortedLive) {
    const liveSecond = secondOf(live.createdAt);
    for (let next = fetched[fetchedIndex]; next && secondOf(next.createdAt) <= liveSecond;) {
      merged.push(next);
      fetchedIndex += 1;
      next = fetched[fetchedIndex];
    }
    merged.push(live);
  }

  return merged.concat(fetched.slice(fetchedIndex));
}

export function mergeHistory(
  current: ChatMessage[],
  history: ChatMessage[],
  options: MergeOptions = {},
): ChatMessage[] {
  const deleted = options.deletedIds ?? new Set<string>();
  const edited = options.editedDuringFetchIds ?? new Set<string>();
  const windowStart = fetchedWindowStartSecond(history, options.pageSize);
  const localById = new Map(current.map((message) => [message.id, message]));
  const fetched: ChatMessage[] = [];
  const fetchedIds = new Set<string>();

  for (const message of history) {
    if (deleted.has(message.id)) continue;
    fetchedIds.add(message.id);
    const local = localById.get(message.id);
    if (local && edited.has(message.id)) {
      fetched.push(local);
      continue;
    }
    fetched.push(local ? { ...message, updatedAt: message.updatedAt || local.updatedAt } : message);
  }

  const liveOnly = current.filter(
    (message) =>
      !deleted.has(message.id) &&
      !fetchedIds.has(message.id) &&
      !wasRemovedServerSide(message, options, windowStart),
  );

  return mergeBySecond(fetched, liveOnly);
}

export function mergeOlderPage(
  current: ChatMessage[],
  page: ChatMessage[],
  options: { deletedIds?: ReadonlySet<string> } = {},
): ChatMessage[] {
  const deleted = options.deletedIds ?? new Set<string>();
  const currentIds = new Set(current.map((message) => message.id));
  const older = page.filter((message) => !deleted.has(message.id) && !currentIds.has(message.id));
  if (older.length === 0) return current;

  return mergeBySecond(older, current);
}

export type OlderHistory = { nextBefore: string | null; loading: boolean; failed: boolean };
export type OlderHistories = Record<string, OlderHistory>;

export function seedOlderHistory(
  histories: OlderHistories,
  roomId: string,
  nextBefore: string | null,
): OlderHistories {
  if (histories[roomId]) return histories;
  return { ...histories, [roomId]: { nextBefore, loading: false, failed: false } };
}

export function patchOlderHistory(
  histories: OlderHistories,
  roomId: string,
  patch: Partial<OlderHistory>,
): OlderHistories {
  const current = histories[roomId] ?? { nextBefore: null, loading: false, failed: false };
  return { ...histories, [roomId]: { ...current, ...patch } };
}

export function canLoadOlder(histories: OlderHistories, roomId: string): boolean {
  const history = histories[roomId];
  return history !== undefined && history.nextBefore !== null && !history.loading;
}

export function shouldApplyOlderPage(
  histories: OlderHistories,
  roomId: string,
  sentCursor: string,
): boolean {
  return histories[roomId]?.nextBefore === sentCursor;
}

type LoadOlderPageDeps = {
  roomId: string;
  getHistories: () => OlderHistories;
  fetchPage: (cursor: string) => Promise<{ messages: HistoryMessage[]; nextBefore: string | null }>;
  commit: (roomId: string, patch: Partial<OlderHistory>) => void;
  applyPage: (page: { messages: HistoryMessage[]; nextBefore: string | null }) => void;
  onUnauthorized: () => void;
  onFailure: () => void;
  isUnauthorizedError: (error: unknown) => boolean;
};

export async function loadOlderPage(deps: LoadOlderPageDeps): Promise<void> {
  const { roomId } = deps;
  if (!canLoadOlder(deps.getHistories(), roomId)) return;

  const cursor = deps.getHistories()[roomId]?.nextBefore;
  if (!cursor) return;
  deps.commit(roomId, { loading: true, failed: false });

  try {
    const page = await deps.fetchPage(cursor);
    if (!shouldApplyOlderPage(deps.getHistories(), roomId, cursor)) return;

    deps.applyPage(page);
    deps.commit(roomId, { nextBefore: page.nextBefore, loading: false });
  } catch (error) {
    if (!shouldApplyOlderPage(deps.getHistories(), roomId, cursor)) return;

    deps.commit(roomId, { loading: false, failed: true });
    if (deps.isUnauthorizedError(error)) {
      deps.onUnauthorized();
      return;
    }
    deps.onFailure();
  }
}

export function createLiveEditTracker() {
  const editedAt = new Map<string, number>();
  let sequence = 0;

  return {
    markEdited: (messageId: string) => {
      sequence += 1;
      editedAt.set(messageId, sequence);
    },
    checkpoint: () => sequence,
    editedSince: (checkpoint: number): Set<string> =>
      new Set(
        Array.from(editedAt.entries())
          .filter(([, at]) => at > checkpoint)
          .map(([messageId]) => messageId),
      ),
    clear: () => editedAt.clear(),
  };
}

export function historyFailureStatus(roomId: string, activeRoomId: string | null): HistoryStatus {
  return roomId === activeRoomId ? "failed" : "stale";
}

export function markHistoryStatus(
  statuses: HistoryStatuses,
  roomId: string,
  status: HistoryStatus,
): HistoryStatuses {
  return { ...statuses, [roomId]: status };
}

export function needsHistory(statuses: HistoryStatuses, roomId: string): boolean {
  const status = statuses[roomId];
  return status === undefined || status === "failed" || status === "stale";
}

type RefetchPriority = { activeRoomId: string | null; recentRoomIds: string[] };

export function markStaleRooms(
  statuses: HistoryStatuses,
  refetchedRoomIds: string[],
): HistoryStatuses {
  const refetched = new Set(refetchedRoomIds);
  const next = { ...statuses };
  for (const [roomId, status] of Object.entries(statuses)) {
    if (status === "loaded" && !refetched.has(roomId)) next[roomId] = "stale";
  }
  return next;
}

export function roomsToRefetch(
  statuses: HistoryStatuses,
  visibleRoomIds: string[],
  { activeRoomId, recentRoomIds }: RefetchPriority,
): string[] {
  const visible = new Set(visibleRoomIds);
  const prioritized = activeRoomId ? [activeRoomId, ...recentRoomIds] : recentRoomIds;
  const candidates = Array.from(new Set(prioritized)).filter(
    (roomId) => visible.has(roomId) && statuses[roomId] === "loaded",
  );
  return candidates.slice(0, MAX_RECENT_REFETCH_ROOMS + 1);
}

export function rememberRecentRoom(recentRoomIds: string[], roomId: string): string[] {
  return [roomId, ...recentRoomIds.filter((id) => id !== roomId)];
}

export function shouldRefetchAfterStatus({
  hasOpenedBefore,
  status,
}: {
  hasOpenedBefore: boolean;
  status: SocketStatus;
}): boolean {
  return hasOpenedBefore && status === "open";
}

type StaggeredRefetchOptions = {
  roomIds: string[];
  fetchRoom: (roomId: string) => Promise<void>;
  onError: (roomId: string, error: unknown) => void;
  wait: (ms: number) => Promise<void>;
  delayMs: number;
  isCancelled?: () => boolean;
};

export async function refetchHistoryStaggered({
  roomIds,
  fetchRoom,
  onError,
  wait,
  delayMs,
  isCancelled = () => false,
}: StaggeredRefetchOptions): Promise<void> {
  for (const [index, roomId] of roomIds.entries()) {
    if (isCancelled()) return;
    if (index > 0) await wait(delayMs);
    if (isCancelled()) return;

    try {
      await fetchRoom(roomId);
    } catch (error) {
      onError(roomId, error);
    }
  }
}

export function diffRoomSubscriptions(
  subscribed: Set<string>,
  roomIds: string[],
): { toSubscribe: string[]; toUnsubscribe: string[] } {
  const wanted = new Set(roomIds);
  return {
    toSubscribe: roomIds,
    toUnsubscribe: Array.from(subscribed).filter((roomId) => !wanted.has(roomId)),
  };
}
