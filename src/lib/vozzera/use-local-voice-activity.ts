import { useEffect, useState } from "react";

import type { LocalAudioTrack } from "livekit-client";
import { isLocalVoiceActive, shouldShowLocalVoiceActivity } from "./voice";

export type LocalVoiceActivityResult = {
  localSpeaking: boolean;
};

type Props = {
  status: string;
  micEnabled: boolean;
  localMicTrack: LocalAudioTrack | null;
  micProcessorRevision: number;
};

export function useLocalVoiceActivity({
  status,
  micEnabled,
  localMicTrack,
  micProcessorRevision,
}: Props): LocalVoiceActivityResult {
  const [localSpeaking, setLocalSpeaking] = useState(false);

  useEffect(() => {
    if (status !== "connected" || !micEnabled || !localMicTrack) {
      setLocalSpeaking(false);
      return;
    }

    let cancelled = false;
    let animationFrame = 0;
    let cleanupAnalyser: (() => Promise<void>) | null = null;
    let active = false;
    let silenceStartedAt: number | null = null;

    void import("livekit-client")
      .then(({ createAudioAnalyser }) => {
        if (cancelled) return;

        const analyser = createAudioAnalyser(localMicTrack, {
          fftSize: 256,
          smoothingTimeConstant: 0.15,
          minDecibels: -75,
          maxDecibels: -25,
        });
        cleanupAnalyser = analyser.cleanup;

        const readVolume = (timestamp: number) => {
          if (cancelled) return;
          const hasVoiceLevel = isLocalVoiceActive(analyser.calculateVolume(), active);
          if (hasVoiceLevel) silenceStartedAt = null;
          if (!hasVoiceLevel && silenceStartedAt === null) silenceStartedAt = timestamp;
          const silenceDuration = silenceStartedAt === null ? 0 : timestamp - silenceStartedAt;
          const nextActive = shouldShowLocalVoiceActivity(hasVoiceLevel, active, silenceDuration);
          if (nextActive !== active) {
            active = nextActive;
            setLocalSpeaking(nextActive);
          }
          animationFrame = requestAnimationFrame(readVolume);
        };

        animationFrame = requestAnimationFrame(readVolume);
      })
      .catch(() => {
        if (!cancelled) setLocalSpeaking(false);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      setLocalSpeaking(false);
      if (cleanupAnalyser) void cleanupAnalyser();
    };
  }, [localMicTrack, micEnabled, micProcessorRevision, status]);

  return { localSpeaking };
}
