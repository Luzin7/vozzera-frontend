import { useCallback, useRef, useState } from "react";

import type { RemoteParticipant } from "livekit-client";
import {
  effectiveParticipantVolume,
  muteVolume,
  readParticipantVolumes,
  readScreenShareVolumes,
  writeParticipantVolumes,
  writeScreenShareVolumes,
} from "./voice";
import { migrateScreenShareVolumeKey, migrateVolumeKey } from "./call-participants";

export type ScreenShareAudioSource = NonNullable<Parameters<RemoteParticipant["setVolume"]>[1]>;

function setRemoteParticipantVolume(participant: RemoteParticipant, volume: number | undefined) {
  participant.setVolume(effectiveParticipantVolume(volume));
}

export function setRemoteParticipantScreenShareVolume(
  participant: RemoteParticipant,
  volume: number | undefined,
  ssAudioSource: ScreenShareAudioSource | null,
) {
  if (ssAudioSource === null) return;
  participant.setVolume(effectiveParticipantVolume(volume), ssAudioSource);
}

type RoomRef = { readonly current: import("livekit-client").Room | null };

export type VolumeResult = {
  volumes: Record<string, number>;
  screenShareVolumes: Record<string, number>;
  mutedParticipants: Record<string, boolean>;
  screenShareMutedParticipants: Record<string, boolean>;
  applyParticipantVolumes: (p: RemoteParticipant) => void;
  removeParticipant: (identity: string) => void;
  setParticipantVolume: (identity: string, volume: number) => void;
  setScreenShareVolume: (identity: string, volume: number) => void;
  setLocalMute: (identity: string, muted: boolean) => void;
  toggleLocalMute: (identity: string) => void;
  setLocalScreenShareMute: (identity: string, muted: boolean) => void;
  toggleLocalScreenShareMute: (identity: string) => void;
  setRemoteMuted: (identity: string, muted: boolean) => void;
  getScreenShareVolumeRef: () => Record<string, number>;
  resetState: () => void;
};

type ScreenShareAudioSourceRef = { readonly current: ScreenShareAudioSource | null };

export function useParticipantVolume(
  roomRef: RoomRef,
  screenShareAudioSourceRef: ScreenShareAudioSourceRef,
): VolumeResult {
  const [volumes, setVolumes] = useState<Record<string, number>>(() => {
    if (typeof localStorage === "undefined") return {};
    return readParticipantVolumes(localStorage);
  });
  const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>(() => {
    if (typeof localStorage === "undefined") return {};
    return readScreenShareVolumes(localStorage);
  });
  const [mutedParticipants, setMutedParticipants] = useState<Record<string, boolean>>({});
  const [screenShareMutedParticipants, setScreenShareMutedParticipants] = useState<
    Record<string, boolean>
  >({});

  const volumesRef = useRef(volumes);
  const screenShareVolumesRef = useRef(screenShareVolumes);
  const mutedVolumesRef = useRef<Record<string, number>>({});
  const screenShareMutedVolumesRef = useRef<Record<string, number>>({});

  volumesRef.current = volumes;
  screenShareVolumesRef.current = screenShareVolumes;

  const migrateLegacyVolumes = useCallback((p: RemoteParticipant) => {
    if (typeof localStorage === "undefined") return;
    const keys = { identity: p.identity, name: p.name || p.identity };

    if (migrateVolumeKey(localStorage, keys)) {
      volumesRef.current = readParticipantVolumes(localStorage);
      setVolumes(volumesRef.current);
    }
    if (migrateScreenShareVolumeKey(localStorage, keys)) {
      screenShareVolumesRef.current = readScreenShareVolumes(localStorage);
      setScreenShareVolumes(screenShareVolumesRef.current);
    }
  }, []);

  const applyParticipantVolumes = useCallback(
    (p: RemoteParticipant) => {
      migrateLegacyVolumes(p);
      const volume = volumesRef.current[p.identity];
      const ssVolume = screenShareVolumesRef.current[p.identity];
      setRemoteParticipantVolume(p, volume);
      setRemoteParticipantScreenShareVolume(p, ssVolume, screenShareAudioSourceRef.current);
    },
    [migrateLegacyVolumes, screenShareAudioSourceRef],
  );

  const setParticipantVolume = useCallback(
    (identity: string, volume: number) => {
      const next = { ...volumesRef.current, [identity]: volume };
      volumesRef.current = next;
      setVolumes(next);
      writeParticipantVolumes(typeof localStorage === "undefined" ? null : localStorage, next);

      const participant = roomRef.current?.remoteParticipants.get(identity);
      if (participant) setRemoteParticipantVolume(participant, volume);
    },
    [roomRef],
  );

  const setScreenShareVolume = useCallback(
    (identity: string, volume: number) => {
      const next = { ...screenShareVolumesRef.current, [identity]: volume };
      screenShareVolumesRef.current = next;
      setScreenShareVolumes(next);
      writeScreenShareVolumes(typeof localStorage === "undefined" ? null : localStorage, next);

      const participant = roomRef.current?.remoteParticipants.get(identity);
      if (participant)
        setRemoteParticipantScreenShareVolume(
          participant,
          volume,
          screenShareAudioSourceRef.current,
        );
    },
    [roomRef, screenShareAudioSourceRef],
  );

  const setLocalMute = useCallback(
    (identity: string, muted: boolean) => {
      const current = volumesRef.current[identity];

      if (muted) {
        mutedVolumesRef.current[identity] = current ?? 1;
        setParticipantVolume(identity, muteVolume(true, undefined));
        return;
      }

      const previous = mutedVolumesRef.current[identity];
      delete mutedVolumesRef.current[identity];
      setParticipantVolume(identity, muteVolume(false, previous));
    },
    [setParticipantVolume],
  );

  const toggleLocalMute = useCallback(
    (identity: string) => {
      setLocalMute(identity, volumesRef.current[identity] !== 0);
    },
    [setLocalMute],
  );

  const setLocalScreenShareMute = useCallback(
    (identity: string, muted: boolean) => {
      const current = screenShareVolumesRef.current[identity];

      if (muted) {
        screenShareMutedVolumesRef.current[identity] = current ?? 1;
        setScreenShareVolume(identity, muteVolume(true, undefined));
        setScreenShareMutedParticipants((prev) => ({ ...prev, [identity]: true }));
        return;
      }

      const previous = screenShareMutedVolumesRef.current[identity];
      delete screenShareMutedVolumesRef.current[identity];
      setScreenShareVolume(identity, muteVolume(false, previous));
      setScreenShareMutedParticipants((prev) => ({ ...prev, [identity]: false }));
    },
    [setScreenShareVolume],
  );

  const toggleLocalScreenShareMute = useCallback(
    (identity: string) => {
      setLocalScreenShareMute(identity, screenShareVolumesRef.current[identity] !== 0);
    },
    [setLocalScreenShareMute],
  );

  const removeParticipant = useCallback((identity: string) => {
    setMutedParticipants((prev) => {
      if (!(identity in prev)) return prev;
      const next = { ...prev };
      delete next[identity];
      return next;
    });
    setScreenShareMutedParticipants((prev) => {
      if (!(identity in prev)) return prev;
      const next = { ...prev };
      delete next[identity];
      return next;
    });
    delete mutedVolumesRef.current[identity];
    delete screenShareMutedVolumesRef.current[identity];
  }, []);

  const setRemoteMuted = useCallback((identity: string, muted: boolean) => {
    setMutedParticipants((prev) => ({ ...prev, [identity]: muted }));
  }, []);

  const getScreenShareVolumeRef = useCallback(() => screenShareVolumesRef.current, []);

  const resetState = useCallback(() => {
    setMutedParticipants({});
    setScreenShareMutedParticipants({});
    mutedVolumesRef.current = {};
    screenShareMutedVolumesRef.current = {};
  }, []);

  return {
    volumes,
    screenShareVolumes,
    mutedParticipants,
    screenShareMutedParticipants,
    applyParticipantVolumes,
    removeParticipant,
    setParticipantVolume,
    setScreenShareVolume,
    setLocalMute,
    toggleLocalMute,
    setLocalScreenShareMute,
    toggleLocalScreenShareMute,
    setRemoteMuted,
    getScreenShareVolumeRef,
    resetState,
  };
}
