import { useCallback, useEffect, useRef, useState } from "react";
import { Track, VideoPresets } from "livekit-client";
import type {
  LocalTrackPublication,
  LocalVideoTrack,
  Participant,
  RemoteTrackPublication,
  Room,
  TrackPublication,
} from "livekit-client";

import {
  CAMERA_PUBLISH_OPTIONS,
  DESKTOP_CAMERA_CAP,
  MOBILE_CAMERA_CAP,
  cameraErrorFrom,
  canPublishCamera,
  visibleCameraIdentities,
  type CameraFacingMode,
} from "@/lib/vozzera/camera";
import type { CameraErrorKind } from "@/lib/vozzera/camera-errors";
import {
  clearCameraState,
  resetCameraStore,
  setCameraState,
  setLocalCameraPublishing,
} from "@/lib/vozzera/camera-store";

type RoomRef = { current: Room | null };

type UseCameraOptions = {
  roomRef: RoomRef;
  deviceCount: number | null;
};

type CameraOperation = "enable" | "disable" | null;
type CameraPageAction = "keep" | "resume" | "disable";

export function cameraOperationFor(targetOn: boolean, cameraOn: boolean): CameraOperation {
  if (targetOn === cameraOn) return null;
  return targetOn ? "enable" : "disable";
}

export function nextCameraTarget(targetOn: boolean): boolean {
  return !targetOn;
}

export function cameraPageAction(hidden: boolean, pageExiting: boolean): CameraPageAction {
  if (pageExiting) return "disable";
  if (hidden) return "keep";
  return "resume";
}

function cameraPublicationFor(participant: Participant): TrackPublication | undefined {
  return participant.getTrackPublication(Track.Source.Camera);
}

function currentFacingMode(track: LocalVideoTrack): CameraFacingMode {
  return track.mediaStreamTrack.getSettings().facingMode === "environment" ? "environment" : "user";
}

async function cameraPermissionDenied(): Promise<boolean> {
  if (!navigator.permissions?.query) return false;
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state === "denied";
  } catch {
    return false;
  }
}

export function useCamera({ roomRef, deviceCount }: UseCameraOptions) {
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>("user");
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const targetOnRef = useRef(false);
  const transitionRef = useRef<Promise<void>>(Promise.resolve());
  const mobileRef = useRef(false);

  const syncLocalTrack = useCallback(
    (track: LocalVideoTrack | null) => {
      const room = roomRef.current;
      const identity = room?.localParticipant.identity;
      trackRef.current = track;
      const on = track !== null;
      setCameraOn(on);
      setLocalCameraPublishing(on);
      if (!identity) return;
      if (!track) {
        clearCameraState(identity);
        return;
      }
      const nextFacingMode = currentFacingMode(track);
      setFacingMode(nextFacingMode);
      setCameraState(identity, {
        on: true,
        muted: false,
        isLocal: true,
        facingMode: nextFacingMode,
        track,
      });
    },
    [roomRef],
  );

  const applySubscriptionCap = useCallback((room: Room) => {
    const remoteParticipants = [...room.remoteParticipants.values()];
    const cap = mobileRef.current ? MOBILE_CAMERA_CAP : DESKTOP_CAMERA_CAP;
    const visible = new Set(
      visibleCameraIdentities(
        remoteParticipants.map((participant) => {
          const publication = cameraPublicationFor(participant);
          return {
            identity: participant.identity,
            isLocal: false,
            cameraOn: publication !== undefined && !publication.isMuted,
          };
        }),
        cap,
      ),
    );

    for (const participant of remoteParticipants) {
      const publication = cameraPublicationFor(participant) as RemoteTrackPublication | undefined;
      if (!publication) {
        clearCameraState(participant.identity);
        continue;
      }
      const enabled = visible.has(participant.identity);
      publication.setEnabled(enabled);
      const track = enabled && !publication.isMuted ? (publication.videoTrack ?? null) : null;
      setCameraState(participant.identity, {
        on: track !== null,
        muted: publication.isMuted,
        isLocal: false,
        facingMode: "user",
        track,
      });
    }
  }, []);

  const enableOnce = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (deviceCount === 0) {
      setError("no-device");
      targetOnRef.current = false;
      return;
    }
    if (!canPublishCamera(navigator.mediaDevices)) {
      setError("unsupported");
      targetOnRef.current = false;
      return;
    }
    if (await cameraPermissionDenied()) {
      setError("denied");
      targetOnRef.current = false;
      return;
    }

    let track: LocalVideoTrack;
    try {
      const { createLocalVideoTrack } = await import("livekit-client");
      track = await createLocalVideoTrack({ resolution: VideoPresets.h720, facingMode });
    } catch (captureError) {
      setError(cameraErrorFrom(captureError));
      targetOnRef.current = false;
      return;
    }

    try {
      await room.localParticipant.publishTrack(track, CAMERA_PUBLISH_OPTIONS);
    } catch {
      track.stop();
      setError("publish-failed");
      targetOnRef.current = false;
      return;
    }

    track.mediaStreamTrack.addEventListener(
      "ended",
      () => {
        targetOnRef.current = false;
        setError("publish-failed");
        void room.localParticipant.unpublishTrack(track, true).catch(() => undefined);
        syncLocalTrack(null);
      },
      { once: true },
    );
    setError(null);
    setNotice(null);
    syncLocalTrack(track);
  }, [deviceCount, facingMode, roomRef, syncLocalTrack]);

  const disableOnce = useCallback(async () => {
    const room = roomRef.current;
    const track = trackRef.current;
    if (!track) {
      syncLocalTrack(null);
      return;
    }
    if (room) await room.localParticipant.unpublishTrack(track, true).catch(() => undefined);
    track.stop();
    syncLocalTrack(null);
  }, [roomRef, syncLocalTrack]);

  const reconcile = useCallback(async () => {
    const operation = cameraOperationFor(targetOnRef.current, trackRef.current !== null);
    if (operation === "enable") await enableOnce();
    if (operation === "disable") await disableOnce();
    const nextOperation = cameraOperationFor(targetOnRef.current, trackRef.current !== null);
    if (nextOperation !== null) await reconcile();
  }, [disableOnce, enableOnce]);

  const queueReconcile = useCallback(() => {
    transitionRef.current = transitionRef.current.then(reconcile, reconcile);
    return transitionRef.current;
  }, [reconcile]);

  const enable = useCallback(() => {
    targetOnRef.current = true;
    return queueReconcile();
  }, [queueReconcile]);

  const disable = useCallback(() => {
    targetOnRef.current = false;
    return queueReconcile();
  }, [queueReconcile]);

  const disableForPageExit = useCallback(() => {
    targetOnRef.current = false;
    const track = trackRef.current;
    if (!track) return;
    const room = roomRef.current;
    if (room) void room.localParticipant.unpublishTrack(track, true).catch(() => undefined);
    track.stop();
    syncLocalTrack(null);
  }, [roomRef, syncLocalTrack]);

  const toggle = useCallback(() => {
    targetOnRef.current = nextCameraTarget(targetOnRef.current);
    return queueReconcile();
  }, [queueReconcile]);

  const switchFacing = useCallback(async () => {
    const track = trackRef.current;
    const next = facingMode === "user" ? "environment" : "user";
    if (!track) {
      setFacingMode(next);
      return;
    }
    try {
      await track.restartTrack({ facingMode: next, resolution: VideoPresets.h720 });
      setFacingMode(next);
      const identity = roomRef.current?.localParticipant.identity;
      if (identity) setCameraState(identity, { facingMode: next, track });
    } catch {
      setError("publish-failed");
    }
  }, [facingMode, roomRef]);

  const onTrackSubscribed = useCallback(
    (room: Room, track: import("livekit-client").Track) => {
      if (track.source !== Track.Source.Camera) return false;
      applySubscriptionCap(room);
      return true;
    },
    [applySubscriptionCap],
  );

  const onTrackUnsubscribed = useCallback(
    (track: import("livekit-client").Track, participant: Participant) => {
      if (track.source !== Track.Source.Camera) return false;
      track.detach();
      clearCameraState(participant.identity);
      return true;
    },
    [],
  );

  const onPublicationChanged = useCallback(
    (room: Room, publication: TrackPublication, participant: Participant) => {
      if (publication.source !== Track.Source.Camera) return false;
      if (participant.isLocal) {
        const localTrack = publication.videoTrack as LocalVideoTrack | undefined;
        if (publication.isMuted) {
          trackRef.current = localTrack ?? trackRef.current;
          setCameraOn(false);
          setLocalCameraPublishing(false);
          setCameraState(participant.identity, {
            on: false,
            muted: true,
            isLocal: true,
            facingMode,
            track: localTrack ?? trackRef.current,
          });
          return true;
        }
        syncLocalTrack(localTrack ?? null);
        return true;
      }
      applySubscriptionCap(room);
      return true;
    },
    [applySubscriptionCap, facingMode, syncLocalTrack],
  );

  const onLocalTrackPublished = useCallback(
    (publication: LocalTrackPublication) => {
      if (publication.source !== Track.Source.Camera) return false;
      syncLocalTrack((publication.videoTrack as LocalVideoTrack | undefined) ?? null);
      return true;
    },
    [syncLocalTrack],
  );

  const onLocalTrackUnpublished = useCallback(
    (publication: LocalTrackPublication) => {
      if (publication.source !== Track.Source.Camera) return false;
      targetOnRef.current = false;
      syncLocalTrack(null);
      return true;
    },
    [syncLocalTrack],
  );

  const removeParticipant = useCallback((identity: string) => clearCameraState(identity), []);

  const resetState = useCallback(() => {
    targetOnRef.current = false;
    trackRef.current?.stop();
    trackRef.current = null;
    setCameraOn(false);
    setError(null);
    setNotice(null);
    setFacingMode("user");
    resetCameraStore();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const room = roomRef.current;
      if (room) applySubscriptionCap(room);
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const applyFormFactor = () => {
      mobileRef.current = mediaQuery.matches;
      const room = roomRef.current;
      if (room) applySubscriptionCap(room);
    };
    applyFormFactor();
    mediaQuery.addEventListener("change", applyFormFactor);
    return () => mediaQuery.removeEventListener("change", applyFormFactor);
  }, [applySubscriptionCap, roomRef]);

  useEffect(() => {
    if (deviceCount === null) return;
    if (deviceCount > 0) {
      setError((current) => (current === "no-device" ? null : current));
      return;
    }
    setError("no-device");
    if (trackRef.current) void disable();
  }, [deviceCount, disable]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (cameraPageAction(document.hidden, false) === "keep") return;

      const track = trackRef.current;
      if (!track?.isMuted) return;
      void track.restartTrack({ facingMode, resolution: VideoPresets.h720 }).catch(() => {
        setError("publish-failed");
        void disable();
      });
    };
    const onPageHide = () => {
      if (cameraPageAction(document.hidden, true) !== "disable") return;
      if (!trackRef.current) return;
      setNotice("Sua câmera foi desligada quando você saiu da aba.");
      disableForPageExit();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [disable, disableForPageExit, facingMode]);

  return {
    cameraOn,
    error,
    notice,
    facingMode,
    enable,
    disable,
    toggle,
    switchFacing,
    applySubscriptionCap,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onPublicationChanged,
    onLocalTrackPublished,
    onLocalTrackUnpublished,
    removeParticipant,
    resetState,
  };
}
