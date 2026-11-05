import { useCallback, useRef, useState } from "react";

import type { Room, RemoteParticipant, RemoteTrackPublication } from "livekit-client";
import {
  addWatchIntent,
  shouldAcceptSubscribedShare,
  applyWatchIntent,
  applyWatchIntentToParticipant,
  deriveAvailableShares,
  removeWatchIntent,
} from "./screen-share-watch";
import type { LiveShare, WatchIntents } from "./screen-share-watch";

export type LiveShareWatchResult = {
  liveShares: LiveShare[];
  watchingIdentities: WatchIntents;
  hasWatchIntent: (identity: string) => boolean;
  watchShare: (room: Room, identity: string) => void;
  stopWatchingShare: (room: Room, identity: string) => void;
  applyInitialShares: (room: Room) => void;
  refreshLiveShares: (room: Room) => void;
  onShareTrackPublished: (
    room: Room,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => void;
  resetState: () => void;
};

export function useLiveShareWatch(): LiveShareWatchResult {
  const intentsRef = useRef<WatchIntents>(new Set());
  const [watchingIdentities, setWatchingIdentities] = useState<WatchIntents>(new Set());
  const [liveShares, setLiveShares] = useState<LiveShare[]>([]);

  const refreshLiveShares = useCallback((room: Room) => {
    setLiveShares(deriveAvailableShares(room.remoteParticipants.values()));
  }, []);

  const applyInitialShares = useCallback(
    (room: Room) => {
      for (const participant of room.remoteParticipants.values()) {
        applyWatchIntentToParticipant(participant, intentsRef.current);
      }
      refreshLiveShares(room);
    },
    [refreshLiveShares],
  );

  const onShareTrackPublished = useCallback(
    (room: Room, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      applyWatchIntent(participant.identity, publication, intentsRef.current);
      refreshLiveShares(room);
    },
    [refreshLiveShares],
  );

  const hasWatchIntent = useCallback(
    (identity: string) => shouldAcceptSubscribedShare(identity, intentsRef.current),
    [],
  );

  const updateIntent = useCallback((room: Room, identity: string, intents: WatchIntents) => {
    intentsRef.current = intents;
    setWatchingIdentities(intents);
    const participant = room.remoteParticipants.get(identity);
    if (participant) applyWatchIntentToParticipant(participant, intents);
  }, []);

  const watchShare = useCallback(
    (room: Room, identity: string) =>
      updateIntent(room, identity, addWatchIntent(intentsRef.current, identity)),
    [updateIntent],
  );

  const stopWatchingShare = useCallback(
    (room: Room, identity: string) =>
      updateIntent(room, identity, removeWatchIntent(intentsRef.current, identity)),
    [updateIntent],
  );

  const resetState = useCallback(() => {
    intentsRef.current = new Set();
    setWatchingIdentities(new Set());
    setLiveShares([]);
  }, []);

  return {
    liveShares,
    watchingIdentities,
    hasWatchIntent,
    watchShare,
    stopWatchingShare,
    applyInitialShares,
    refreshLiveShares,
    onShareTrackPublished,
    resetState,
  };
}
