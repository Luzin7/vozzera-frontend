import { useCallback, useState } from "react";

import type {
  LocalVideoTrack,
  RemoteVideoTrack,
  ScreenShareCaptureOptions,
  TrackPublishOptions,
} from "livekit-client";
import { Track, VideoQuality } from "livekit-client";
import {
  applyVideoPlaybackDelay,
  screenShareAudioCaptureOptions,
  screenSharePublishOptions,
  VIDEO_PLAYBACK_DELAY_MS,
} from "./voice";

export type { ScreenShareQuality } from "./voice";

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
    quality?: import("./voice").ScreenShareQuality,
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

export function useScreenShare(): ScreenShareResult {
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [localPreview, setLocalPreview] = useState<ScreenShare | null>(null);

  const setScreenShare = useCallback(
    async (
      room: import("livekit-client").Room,
      enabled: boolean,
      quality?: import("./voice").ScreenShareQuality,
    ) => {
      if (!enabled) {
        await room.localParticipant.setScreenShareEnabled(false);
        setSharingEnabled(false);
        setLocalPreview(null);
        return;
      }

      const options: ScreenShareCaptureOptions = quality
        ? {
            audio: screenShareAudioCaptureOptions(),
            resolution: {
              width: quality.width,
              height: quality.height,
              frameRate: quality.frameRate,
            },
          }
        : { audio: screenShareAudioCaptureOptions() };

      const publishQuality = quality ?? { width: 1920, height: 1080, frameRate: 60 };
      const publishOptions = screenSharePublishOptions(publishQuality) as TrackPublishOptions;
      const publication = await room.localParticipant.setScreenShareEnabled(
        true,
        options,
        publishOptions,
      );
      const track = publication?.videoTrack as LocalVideoTrack | undefined;
      if (track?.mediaStreamTrack) track.mediaStreamTrack.contentHint = "motion";
      const name = room.localParticipant.name || room.localParticipant.identity;

      setSharingEnabled(true);
      setLocalPreview(track ? { id: "local", name, track } : null);
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
      remotePub.setVideoQuality(VideoQuality.HIGH);
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
    track.detach().forEach((el) => el.remove());
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
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    resetState,
  };
}
