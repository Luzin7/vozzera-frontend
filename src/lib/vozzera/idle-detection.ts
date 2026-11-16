export const IDLE_THRESHOLD_MS = 60_000;
export const LOCK_GRACE_MS = 30_000;

export type IdlePermissionState = "granted" | "denied" | "prompt";

export type IdleSnapshot = { userState: string; screenState: string };

type IdleDetectorInstance = {
  readonly userState: string | null;
  readonly screenState: string | null;
  start(options: { threshold: number }): Promise<void>;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
};

type IdleDetectorConstructor = {
  new (): IdleDetectorInstance;
  requestPermission(): Promise<IdlePermissionState>;
};

export type LockDecision = {
  lockedSince: number | null;
  action: "leave" | "away" | null;
  checkAt: number | null;
};

export type LockContext = { alone: boolean; live: boolean };

export type IdlePermissionRequestState = IdlePermissionState | "pending" | null;

export type IdlePermissionGate = {
  request(): void;
  readonly state: IdlePermissionRequestState;
};

export type IdleChangeListener = (snapshot: IdleSnapshot) => void;

let detector: IdleDetectorInstance | null = null;
let snapshot: IdleSnapshot | null = null;
const idleChangeListeners = new Set<IdleChangeListener>();

function idleDetectorConstructor(): IdleDetectorConstructor | null {
  const ctor = (globalThis as unknown as { IdleDetector?: IdleDetectorConstructor }).IdleDetector;
  return ctor ?? null;
}

function syncSnapshot(): void {
  if (detector === null) {
    snapshot = null;
    return;
  }
  snapshot = {
    userState: detector.userState ?? "idle",
    screenState: detector.screenState ?? "unlocked",
  };
}

function notifyIdleChange(): void {
  const current = snapshot;
  if (current === null) return;
  for (const listener of idleChangeListeners) listener(current);
}

function handleIdleChange(): void {
  syncSnapshot();
  notifyIdleChange();
}

export function onIdleChange(listener: IdleChangeListener): () => void {
  idleChangeListeners.add(listener);
  return () => {
    idleChangeListeners.delete(listener);
  };
}

export function isIdleDetectionSupported(): boolean {
  return idleDetectorConstructor() !== null;
}

export async function requestIdleDetectionPermission(): Promise<IdlePermissionState> {
  const ctor = idleDetectorConstructor();
  if (ctor === null) return "denied";
  try {
    return await ctor.requestPermission();
  } catch {
    // some browsers reject the permission request instead of resolving it
    return "denied";
  }
}

export function startIdleDetection(): void {
  if (detector !== null) return;
  const ctor = idleDetectorConstructor();
  if (ctor === null) return;
  try {
    const instance = new ctor();
    instance.addEventListener("change", handleIdleChange);
    detector = instance;
    syncSnapshot();
    void instance.start({ threshold: IDLE_THRESHOLD_MS }).catch(() => {
      if (detector === instance) stopIdleDetection();
    });
  } catch {
    // constructing the detector throws without a granted permission in some browsers
  }
}

export function stopIdleDetection(): void {
  const current = detector;
  detector = null;
  snapshot = null;
  if (current === null) return;
  try {
    current.removeEventListener("change", handleIdleChange);
  } catch {
    // the detector is already discarded; a failing remove must not break leaving the call
  }
}

export function getIdleSnapshot(): IdleSnapshot | null {
  return snapshot;
}

export function refreshedActivityAt(
  current: number,
  idleSnapshot: IdleSnapshot | null,
  now: number,
): number {
  if (idleSnapshot?.userState !== "active") return current;
  return now;
}

export function lockDecisionAt(
  previousLockedSince: number | null,
  idleSnapshot: IdleSnapshot | null,
  context: LockContext,
  now: number,
): LockDecision {
  if (idleSnapshot?.screenState !== "locked" || context.live) {
    return { lockedSince: null, action: null, checkAt: null };
  }
  const lockedSince = previousLockedSince ?? now;
  if (now - lockedSince < LOCK_GRACE_MS) {
    return { lockedSince, action: null, checkAt: lockedSince + LOCK_GRACE_MS };
  }
  return { lockedSince, action: context.alone ? "leave" : "away", checkAt: null };
}

export function createIdlePermissionGate(
  request: () => Promise<IdlePermissionState>,
): IdlePermissionGate {
  let state: IdlePermissionRequestState = null;

  return {
    get state() {
      return state;
    },
    request() {
      if (state !== null && state !== "prompt") return;
      state = "pending";
      void request().then(
        (next) => {
          state = next;
        },
        () => {
          state = "denied";
        },
      );
    },
  };
}
