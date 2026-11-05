export type AwayReason = "idle" | "connection";

export type AwayIntent = { roomId: string; reason: AwayReason };

export type AwayCommand = { type: "enter"; intent: AwayIntent } | { type: "leave" };

export type AwayIntentTracker = {
  set: (next: AwayIntent | null, socketOpen: boolean) => AwayCommand[];
  onOpen: () => AwayCommand[];
  onResync: () => AwayCommand[];
  drop: () => void;
};

function sameIntent(a: AwayIntent | null, b: AwayIntent | null): boolean {
  if (a === null || b === null) return a === b;
  return a.roomId === b.roomId && a.reason === b.reason;
}

export function createAwayIntentTracker(): AwayIntentTracker {
  let intent: AwayIntent | null = null;
  let everEntered = false;
  let pendingLeave = false;

  const enterCommands = (): AwayCommand[] => {
    if (intent === null) return [];
    everEntered = true;
    pendingLeave = false;
    return [{ type: "enter", intent }];
  };

  const leaveCommands = (): AwayCommand[] => {
    pendingLeave = false;
    everEntered = false;
    return [{ type: "leave" }];
  };

  return {
    set(next, socketOpen) {
      if (sameIntent(intent, next)) return [];
      intent = next;
      if (next !== null) return socketOpen ? enterCommands() : [];
      if (!everEntered) return [];
      if (!socketOpen) {
        pendingLeave = true;
        return [];
      }
      return leaveCommands();
    },
    onOpen() {
      if (intent !== null) return enterCommands();
      if (pendingLeave) return leaveCommands();
      return [];
    },
    onResync: enterCommands,
    drop() {
      intent = null;
      everEntered = false;
      pendingLeave = false;
    },
  };
}
