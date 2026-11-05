import { useCallback, useEffect, useRef, useState } from "react";

import {
  awayEndedActionFor,
  endModeFor,
  exitNoticeTextFor,
  inactivityActionAt,
  inactivityWarningTextFor,
  latestActivityAt,
  mergeActivityMessage,
  nextInactivityCheckAt,
  recentResends,
  OWN_AWAY_TEXT,
  shouldRecordActivity,
} from "@/lib/vozzera/away";
import type { AwayPresence } from "@/lib/vozzera/away";
import type { AwayIntent, AwayReason } from "@/lib/vozzera/away-intent";
import type { CallParticipant } from "@/lib/vozzera/call-participants";
import { canNotify } from "@/lib/vozzera/notifications";
import type { VoicePresence } from "@/lib/vozzera/chat";
import type { AwayEndedEvent } from "@/lib/vozzera/useChat";
import type { AwayInfo, VoiceStatus } from "@/lib/vozzera/useVoice";

const ACT_RETRY_MS = 5_000;
const ACTIVITY_CHANNEL = "vozzera.activity";
const NOTIFICATION_TITLE = "Canal de voz";
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
const LISTENER_OPTIONS = { capture: true, passive: true } as const;

type InactivityVoice = {
  status: VoiceStatus;
  activeRoomId: string | null;
  participants: CallParticipant[];
  screenShareEnabled: boolean;
  watchingIdentities: ReadonlySet<string>;
  connectedAt: number | null;
  awayInfo: AwayInfo | null;
  getLastLocalSpeechAt: () => number;
  goAway: (reason: AwayReason) => Promise<void>;
  leaveForInactivity: () => Promise<void>;
  endAway: (reason: "room_empty" | "quiet") => void;
};

type InactivityOptions = {
  enabled: boolean;
  voice: InactivityVoice;
  currentUserId: string | null;
  awayPresenceRef: { readonly current: AwayPresence };
  voicePresenceRef: { readonly current: VoicePresence };
  notificationsEnabled: boolean;
  miniWindowContainer: HTMLElement | null;
  setAwayIntent: (intent: AwayIntent | null) => void;
  dropAwayIntent: () => void;
  resendAwayIntent: () => void;
};

export type InactivityWarning = { alone: boolean; text: string };

function notifyWhenHidden(enabled: boolean, body: string): void {
  if (typeof document === "undefined" || !canNotify(enabled, document.hidden)) return;
  try {
    new Notification(NOTIFICATION_TITLE, { body });
  } catch {
    // some mobile browsers throw "Illegal constructor"; the in-page warning still shows
  }
}

function intentFrom(info: AwayInfo | null): AwayIntent | null {
  if (info === null) return null;
  return { roomId: info.roomId, reason: info.reason };
}

function ownIsAwayAnywhere(presence: AwayPresence, userId: string | null): boolean {
  if (userId === null) return false;
  return Object.values(presence).some((entries) =>
    entries.some((entry) => entry.userId === userId),
  );
}

export function useInactivity({
  enabled,
  voice,
  currentUserId,
  awayPresenceRef,
  voicePresenceRef,
  notificationsEnabled,
  miniWindowContainer,
  setAwayIntent,
  dropAwayIntent,
  resendAwayIntent,
}: Readonly<InactivityOptions>) {
  const connected = voice.status === "connected";
  const alone = !voice.participants.some((participant) => !participant.isLocal);
  const live = voice.screenShareEnabled || voice.watchingIdentities.size > 0;
  const [warning, setWarning] = useState<InactivityWarning | null>(null);

  const latestRef = useRef({
    voice,
    currentUserId,
    notificationsEnabled,
  });
  latestRef.current = { voice, currentUserId, notificationsEnabled };
  const stateRef = useRef({ connected, alone, live });
  stateRef.current = { connected, alone, live };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionAtRef = useRef(0);
  const continuedAtRef = useRef(0);
  const liveEndedAtRef = useRef(0);
  const aloneSinceRef = useRef<number | null>(null);
  const warnedRef = useRef(false);
  const actingRef = useRef(false);
  const resendTimesRef = useRef<number[]>([]);
  const lastPointerMoveAtRef = useRef<number | null>(null);
  const lastBroadcastAtRef = useRef<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const evaluateRef = useRef<() => void>(() => undefined);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const act = useCallback((action: "away" | "leave") => {
    const { voice: current, notificationsEnabled: notify } = latestRef.current;
    actingRef.current = true;
    setWarning(null);
    const parking = action === "away" ? current.goAway("idle") : current.leaveForInactivity();
    notifyWhenHidden(notify, action === "away" ? OWN_AWAY_TEXT : exitNoticeTextFor("inactivity"));
    void parking
      .catch(() => undefined)
      .finally(() => {
        actingRef.current = false;
        if (!stateRef.current.connected) return;
        timerRef.current = setTimeout(() => evaluateRef.current(), ACT_RETRY_MS);
      });
  }, []);

  const showWarning = useCallback((isAlone: boolean) => {
    const text = inactivityWarningTextFor(isAlone);
    setWarning((previous) => (previous?.text === text ? previous : { alone: isAlone, text }));
    if (warnedRef.current) return;
    warnedRef.current = true;
    notifyWhenHidden(latestRef.current.notificationsEnabled, text);
  }, []);

  const evaluate = useCallback(() => {
    clearTimer();
    const state = stateRef.current;
    if (!state.connected || actingRef.current) {
      warnedRef.current = false;
      setWarning(null);
      return;
    }

    const now = Date.now();
    const { voice: current } = latestRef.current;
    const inputs = {
      ...state,
      lastActivityAt: latestActivityAt([
        interactionAtRef.current,
        current.getLastLocalSpeechAt(),
        liveEndedAtRef.current,
        current.connectedAt,
        continuedAtRef.current,
      ]),
      aloneSince: aloneSinceRef.current,
    };
    const action = inactivityActionAt(inputs, now);

    if (action === "away" || action === "leave") {
      act(action);
      return;
    }
    if (action === "warn") {
      showWarning(state.alone);
    } else {
      warnedRef.current = false;
      setWarning(null);
    }

    const next = nextInactivityCheckAt(inputs, now);
    if (next === null) return;
    timerRef.current = setTimeout(() => evaluateRef.current(), Math.max(next - now, 0));
  }, [act, clearTimer, showWarning]);
  evaluateRef.current = evaluate;

  const recordInteraction = useCallback(() => {
    const now = Date.now();
    interactionAtRef.current = now;
    if (shouldRecordActivity(lastBroadcastAtRef.current, now)) {
      lastBroadcastAtRef.current = now;
      channelRef.current?.postMessage({ at: now });
    }
    if (warnedRef.current) evaluateRef.current();
  }, []);

  const continueHere = useCallback(() => {
    continuedAtRef.current = Date.now();
    interactionAtRef.current = continuedAtRef.current;
    evaluateRef.current();
  }, []);

  useEffect(() => {
    if (!connected) actingRef.current = false;
    aloneSinceRef.current = connected && alone ? (aloneSinceRef.current ?? Date.now()) : null;
    evaluate();
    return clearTimer;
  }, [connected, alone, voice.connectedAt, evaluate, clearTimer]);

  const wasLiveRef = useRef(false);
  useEffect(() => {
    if (wasLiveRef.current && !live) liveEndedAtRef.current = Date.now();
    wasLiveRef.current = live;
    evaluateRef.current();
  }, [live]);

  useEffect(() => {
    if (!enabled) return;

    const onInteraction = () => recordInteraction();
    const onPointerMove = () => {
      const now = Date.now();
      if (!shouldRecordActivity(lastPointerMoveAtRef.current, now)) return;
      lastPointerMoveAtRef.current = now;
      recordInteraction();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") recordInteraction();
      evaluateRef.current();
    };

    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, onInteraction, LISTENER_OPTIONS);
    }
    window.addEventListener("pointermove", onPointerMove, LISTENER_OPTIONS);
    window.addEventListener("focus", onInteraction);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, onInteraction, LISTENER_OPTIONS);
      }
      window.removeEventListener("pointermove", onPointerMove, LISTENER_OPTIONS);
      window.removeEventListener("focus", onInteraction);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, recordInteraction]);

  useEffect(() => {
    const miniDocument = miniWindowContainer?.ownerDocument;
    if (!enabled || !miniDocument) return;

    const onInteraction = () => recordInteraction();
    const types = [...INTERACTION_EVENTS, "pointermove"] as const;
    for (const type of types) miniDocument.addEventListener(type, onInteraction, LISTENER_OPTIONS);

    return () => {
      for (const type of types) {
        miniDocument.removeEventListener(type, onInteraction, LISTENER_OPTIONS);
      }
    };
  }, [enabled, miniWindowContainer, recordInteraction]);

  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(ACTIVITY_CHANNEL);
    channel.onmessage = (message: MessageEvent<unknown>) => {
      if (!stateRef.current.connected) return;
      interactionAtRef.current = mergeActivityMessage(
        interactionAtRef.current,
        message.data,
        Date.now(),
      );
    };
    channelRef.current = channel;

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [enabled]);

  const awayRoomId = voice.awayInfo?.roomId ?? null;
  const awayReason = voice.awayInfo?.reason ?? null;
  useEffect(() => {
    setAwayIntent(
      awayRoomId === null || awayReason === null
        ? null
        : { roomId: awayRoomId, reason: awayReason },
    );
  }, [awayRoomId, awayReason, setAwayIntent]);

  useEffect(() => {
    if (!connected) return;
    const { currentUserId: ownId } = latestRef.current;
    if (ownIsAwayAnywhere(awayPresenceRef.current, ownId)) setAwayIntent(null);
  }, [connected, setAwayIntent, awayPresenceRef]);

  useEffect(() => {
    resendTimesRef.current = [];
  }, [awayRoomId, awayReason]);

  const handleAwayEnded = useCallback(
    (event: AwayEndedEvent) => {
      const { voice: current, currentUserId: ownId } = latestRef.current;
      if (current.status !== "away") return;

      const now = Date.now();
      const action = awayEndedActionFor(event, ownId, intentFrom(current.awayInfo), {
        awayPresence: awayPresenceRef.current,
        voicePresence: voicePresenceRef.current,
        resendTimes: resendTimesRef.current,
        now,
      });
      if (action === "ignore") return;

      if (action === "resend") {
        resendTimesRef.current = [...recentResends(resendTimesRef.current, now), now];
        resendAwayIntent();
        return;
      }
      if (endModeFor(resendTimesRef.current, now) === "leave") setAwayIntent(null);
      else dropAwayIntent();
      current.endAway(action === "end" ? "room_empty" : "quiet");
    },
    [awayPresenceRef, voicePresenceRef, dropAwayIntent, resendAwayIntent, setAwayIntent],
  );

  return { warning, continueHere, handleAwayEnded };
}
