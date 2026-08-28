import { useCallback, useRef, useState } from "react";

import type { RemoteParticipant } from "livekit-client";
import {
  muteVolume,
  readParticipantVolumes,
  readScreenShareVolumes,
  writeParticipantVolumes,
  writeScreenShareVolumes,
} from "./voice";

let deafenVolumeActive = false;

export function setDeafenVolumeActive(value: boolean): void {
  deafenVolumeActive = value;
}

let screenShareAudioSource: unknown = null;

export function setScreenShareAudioSource(source: unknown): void {
  screenShareAudioSource = source;
}

function setRemoteParticipantVolume(participant: RemoteParticipant, volume: number) {
  participant.setVolume(deafenVolumeActive ? 0 : volume);
}

export function setRemoteParticipantScreenShareVolume(
  participant: RemoteParticipant,
  volume: number,
) {
  if (screenShareAudioSource === null) return;
  participant.setVolume(
    deafenVolumeActive ? 0 : volume,
    screenShareAudioSource as Parameters<RemoteParticipant["setVolume"]>[1],
  );
}

type RoomRef = { readonly current: import("livekit-client").Room | null };

export type VolumeResult = {
  volumes: Record<string, number>;
  screenShareVolumes: Record<string, number>;
  mutedParticipants: Record<string, boolean>;
  screenShareMutedParticipants: Record<string, boolean>;
  applyParticipantVolumes: (p: RemoteParticipant) => void;
  removeParticipant: (name: string) => void;
  setParticipantVolume: (name: string, volume: number) => void;
  setScreenShareVolume: (name: string, volume: number) => void;
  setLocalMute: (name: string, muted: boolean) => void;
  toggleLocalMute: (name: string) => void;
  setLocalScreenShareMute: (name: string, muted: boolean) => void;
  toggleLocalScreenShareMute: (name: string) => void;
  setRemoteMuted: (name: string, muted: boolean) => void;
  getScreenShareVolumeRef: () => Record<string, number>;
  getVolumeRef: () => Record<string, number>;
  resetState: () => void;
};

export function useParticipantVolume(roomRef: RoomRef): VolumeResult {
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

  const applyParticipantVolumes = useCallback((p: RemoteParticipant) => {
    const name = p.name || p.identity;
    const volume = volumesRef.current[name];
    const ssVolume = screenShareVolumesRef.current[name];
    if (volume === undefined && ssVolume === undefined && deafenVolumeActive) {
      setRemoteParticipantVolume(p, 0);
      setRemoteParticipantScreenShareVolume(p, 0);
      return;
    }
    if (volume !== undefined) setRemoteParticipantVolume(p, volume);
    if (ssVolume !== undefined) setRemoteParticipantScreenShareVolume(p, ssVolume);
  }, []);

  const setParticipantVolume = useCallback(
    (name: string, volume: number) => {
      const next = { ...volumesRef.current, [name]: volume };
      volumesRef.current = next;
      setVolumes(next);
      writeParticipantVolumes(typeof localStorage === "undefined" ? null : localStorage, next);

      const participant = Array.from(roomRef.current?.remoteParticipants.values() ?? []).find(
        (p) => (p.name || p.identity) === name,
      );
      if (participant) setRemoteParticipantVolume(participant, volume);
    },
    [roomRef],
  );

  const setScreenShareVolume = useCallback(
    (name: string, volume: number) => {
      const next = { ...screenShareVolumesRef.current, [name]: volume };
      screenShareVolumesRef.current = next;
      setScreenShareVolumes(next);
      writeScreenShareVolumes(typeof localStorage === "undefined" ? null : localStorage, next);

      const participant = Array.from(roomRef.current?.remoteParticipants.values() ?? []).find(
        (p) => (p.name || p.identity) === name,
      );
      if (participant) setRemoteParticipantScreenShareVolume(participant, volume);
    },
    [roomRef],
  );

  const setLocalMute = useCallback(
    (name: string, muted: boolean) => {
      const current = volumesRef.current[name];

      if (muted) {
        mutedVolumesRef.current[name] = current ?? 1;
        setParticipantVolume(name, muteVolume(true, undefined));
        return;
      }

      const previous = mutedVolumesRef.current[name];
      delete mutedVolumesRef.current[name];
      setParticipantVolume(name, muteVolume(false, previous));
    },
    [setParticipantVolume],
  );

  const toggleLocalMute = useCallback(
    (name: string) => {
      setLocalMute(name, volumesRef.current[name] !== 0);
    },
    [setLocalMute],
  );

  const setLocalScreenShareMute = useCallback(
    (name: string, muted: boolean) => {
      const current = screenShareVolumesRef.current[name];

      if (muted) {
        screenShareMutedVolumesRef.current[name] = current ?? 1;
        setScreenShareVolume(name, muteVolume(true, undefined));
        setScreenShareMutedParticipants((prev) => ({ ...prev, [name]: true }));
        return;
      }

      const previous = screenShareMutedVolumesRef.current[name];
      delete screenShareMutedVolumesRef.current[name];
      setScreenShareVolume(name, muteVolume(false, previous));
      setScreenShareMutedParticipants((prev) => ({ ...prev, [name]: false }));
    },
    [setScreenShareVolume],
  );

  const toggleLocalScreenShareMute = useCallback(
    (name: string) => {
      setLocalScreenShareMute(name, screenShareVolumesRef.current[name] !== 0);
    },
    [setLocalScreenShareMute],
  );

  const removeParticipant = useCallback((name: string) => {
    setMutedParticipants((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setScreenShareMutedParticipants((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    delete mutedVolumesRef.current[name];
    delete screenShareMutedVolumesRef.current[name];
  }, []);

  const setRemoteMuted = useCallback((name: string, muted: boolean) => {
    setMutedParticipants((prev) => ({ ...prev, [name]: muted }));
  }, []);

  const getVolumeRef = useCallback(() => volumesRef.current, []);

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
    getVolumeRef,
    getScreenShareVolumeRef,
    resetState,
  };
}
