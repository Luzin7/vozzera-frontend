import { useCallback, useState } from "react";

import type {
  LocalVideoTrack,
  RemoteVideoTrack,
  ScreenShareCaptureOptions,
  TrackPublishOptions,
} from "livekit-client";
import { ScreenSharePresets, Track } from "livekit-client";
import {
  applyVideoPlaybackDelay,
  screenShareAudioCaptureOptions,
  screenShareProfileFor,
  screenSharePublishOptions,
  VIDEO_PLAYBACK_DELAY_MS,
} from "./voice";
import type { ScreenShareIntent, ScreenShareProfile } from "./voice";

export type ScreenShareTrack = LocalVideoTrack | RemoteVideoTrack;

export type ScreenShare = {
  id: string;
  name: string;
  track: ScreenShareTrack;
};

export type ScreenShareResult = {
  screenShareEnabled: boolean;
  screenShares: ScreenShare[];
  localPreview: ScreenShare | null;
  setScreenShare: (
    room: import("livekit-client").Room,
    enabled: boolean,
    intent?: ScreenShareIntent,
  ) => Promise<void>;
  applyScreenShareIntent: (
    room: import("livekit-client").Room,
    intent: ScreenShareIntent,
  ) => Promise<void>;
  onTrackSubscribed: (
    track: import("livekit-client").Track,
    publication: import("livekit-client").TrackPublication,
    participant: import("livekit-client").Participant,
  ) => void;
  onTrackUnsubscribed: (track: import("livekit-client").Track) => void;
  onLocalTrackUnpublished: (publication: import("livekit-client").LocalTrackPublication) => void;
  resetState: () => void;
};

const DEFAULT_SCREEN_SHARE_INTENT: ScreenShareIntent = "text";

function screenShareConstraintsFor(profile: ScreenShareProfile): MediaTrackConstraints {
  return {
    width: { ideal: profile.constraints.width },
    height: { ideal: profile.constraints.height },
    frameRate: { max: profile.constraints.frameRate },
  };
}

export function useScreenShare(): ScreenShareResult {
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [localPreview, setLocalPreview] = useState<ScreenShare | null>(null);

  const setScreenShare = useCallback(
    async (
      room: import("livekit-client").Room,
      enabled: boolean,
      intent: ScreenShareIntent = DEFAULT_SCREEN_SHARE_INTENT,
    ) => {
      if (!enabled) {
        await room.localParticipant.setScreenShareEnabled(false);
        setSharingEnabled(false);
        setLocalPreview(null);
        return;
      }

      const profile = screenShareProfileFor(intent);
      const options: ScreenShareCaptureOptions = {
        audio: screenShareAudioCaptureOptions(),
        resolution: profile.constraints,
        contentHint: profile.contentHint,
        video: { displaySurface: profile.displaySurface },
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        systemAudio: "include",
      };
      const publishOptions = {
        ...screenSharePublishOptions(intent),
        screenShareSimulcastLayers: [ScreenSharePresets.h360fps15],
      } as TrackPublishOptions;
      const publication = await room.localParticipant.setScreenShareEnabled(
        true,
        options,
        publishOptions,
      );
      const track = publication?.videoTrack as LocalVideoTrack | undefined;
      const name = room.localParticipant.name || room.localParticipant.identity;

      if (track) {
        await track.mediaStreamTrack
          .applyConstraints(screenShareConstraintsFor(profile))
          .catch(() => undefined);
      }

      setSharingEnabled(true);
      setLocalPreview(track ? { id: "local", name, track } : null);
    },
    [],
  );

  const applyScreenShareIntent = useCallback(
    async (room: import("livekit-client").Room, intent: ScreenShareIntent) => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const track = publication?.videoTrack as LocalVideoTrack | undefined;
      if (!track?.sender) return;

      const profile = screenShareProfileFor(intent);
      track.mediaStreamTrack.contentHint = profile.contentHint;
      await track.mediaStreamTrack.applyConstraints(screenShareConstraintsFor(profile));
      await track.setDegradationPreference(profile.degradationPreference);

      const params = track.sender.getParameters();
      const topEncoding = params.encodings.at(-1);
      if (!topEncoding) return;

      topEncoding.maxBitrate = profile.encoding.maxBitrate;
      topEncoding.maxFramerate = profile.encoding.maxFramerate;
      await track.sender.setParameters(params);
    },
    [],
  );

  const onTrackSubscribed = useCallback(
    (
      track: import("livekit-client").Track,
      publication: import("livekit-client").TrackPublication,
      participant: import("livekit-client").Participant,
    ) => {
      if (track.source !== Track.Source.ScreenShare) return;

      const remotePub = publication as import("livekit-client").RemoteTrackPublication;
      remotePub.setEnabled(true);
      applyVideoPlaybackDelay(track as RemoteVideoTrack, VIDEO_PLAYBACK_DELAY_MS);

      const name = participant.name || participant.identity;
      setScreenShares((prev) => [
        ...prev.filter((share) => share.track !== track),
        { id: remotePub.trackSid, name, track: track as RemoteVideoTrack },
      ]);
    },
    [],
  );

  const onTrackUnsubscribed = useCallback((track: import("livekit-client").Track) => {
    track.detach();
    setScreenShares((prev) => prev.filter((share) => share.track !== track));
  }, []);

  const onLocalTrackUnpublished = useCallback(
    (publication: import("livekit-client").LocalTrackPublication) => {
      if (publication.track?.source !== Track.Source.ScreenShare) return;

      setSharingEnabled(false);
      setLocalPreview(null);
    },
    [],
  );

  const resetState = useCallback(() => {
    setSharingEnabled(false);
    setScreenShares([]);
    setLocalPreview(null);
  }, []);

  return {
    screenShareEnabled: sharingEnabled,
    screenShares,
    localPreview,
    setScreenShare,
    applyScreenShareIntent,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    resetState,
  };
}
