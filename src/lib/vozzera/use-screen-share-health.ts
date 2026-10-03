import { useEffect, useRef, useState } from "react";

import { ParticipantEvent, Track } from "livekit-client";
import type { LocalTrackPublication, LocalVideoTrack, Room } from "livekit-client";

import { screenShareHealthFor } from "./voice";
import type { ScreenShareHealth } from "./voice";

type RoomRef = { readonly current: Room | null };

const HEALTH_POLL_INTERVAL_MS = 3_000;
const HEALTH_CONFIRMATION_READINGS = 2;

type HealthStreak = { health: ScreenShareHealth; count: number };

async function readHealth(room: Room): Promise<ScreenShareHealth> {
  const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack as
    LocalVideoTrack | undefined;
  if (!track) return "ok";

  const stats = await track.getSenderStats();
  const last = stats.at(-1);
  return screenShareHealthFor({ qualityLimitationReason: last?.qualityLimitationReason });
}

function commitHealth(
  next: ScreenShareHealth,
  streak: HealthStreak,
  setHealth: (health: ScreenShareHealth) => void,
): void {
  if (next === "ok") {
    streak.health = "ok";
    streak.count = 0;
    setHealth("ok");
    return;
  }

  if (next !== streak.health) {
    streak.health = next;
    streak.count = 1;
    return;
  }

  streak.count += 1;
  if (streak.count < HEALTH_CONFIRMATION_READINGS) return;
  setHealth(next);
}

export function useScreenShareHealth(roomRef: RoomRef, active: boolean): ScreenShareHealth {
  const [health, setHealth] = useState<ScreenShareHealth>("ok");
  const streakRef = useRef<HealthStreak>({ health: "ok", count: 0 });

  useEffect(() => {
    if (!active) {
      setHealth("ok");
      streakRef.current = { health: "ok", count: 0 };
      return;
    }

    const room = roomRef.current;
    if (!room) return;

    const onCpuConstrained = (
      _track: LocalVideoTrack,
      publication: LocalTrackPublication,
    ): void => {
      if (publication.source !== Track.Source.ScreenShare) return;
      streakRef.current = { health: "cpu", count: HEALTH_CONFIRMATION_READINGS };
      setHealth("cpu");
    };
    room.localParticipant.on(ParticipantEvent.LocalTrackCpuConstrained, onCpuConstrained);

    const interval = setInterval(() => {
      void readHealth(room)
        .then((next) => {
          commitHealth(next, streakRef.current, setHealth);
        })
        .catch(() => undefined);
    }, HEALTH_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      room.localParticipant.off(ParticipantEvent.LocalTrackCpuConstrained, onCpuConstrained);
    };
  }, [roomRef, active]);

  return health;
}
