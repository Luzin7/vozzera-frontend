import { useCallback, useRef, useState } from "react";

import type { LocalAudioTrack, Room } from "livekit-client";
import { readNoiseFilter, writeNoiseFilter } from "./voice";

type KrispNoiseFilterProcessor = import("@livekit/krisp-noise-filter").KrispNoiseFilterProcessor;
type AudioTrackProcessor = import("livekit-client").TrackProcessor<
  import("livekit-client").Track.Kind.Audio,
  import("livekit-client").AudioProcessorOptions
>;

async function applyKrispToggle(
  processor: KrispNoiseFilterProcessor,
  enabled: boolean,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await processor.setEnabled(enabled);
  } catch {
    onError("Não consegui aplicar o filtro de ruído.");
  }
}

type RoomRef = { readonly current: Room | null };

export type KrispFilterResult = {
  krispSupported: boolean | null;
  noiseFilter: boolean;
  micProcessorRevision: number;
  ensureKrispLoaded: () => Promise<boolean>;
  createKrispProcessor: () => Promise<KrispNoiseFilterProcessor | null>;
  attachKrispNoiseFilter: (track: LocalAudioTrack) => Promise<void>;
  applyInitialProcessor: (
    track: LocalAudioTrack,
    processor: KrispNoiseFilterProcessor,
  ) => Promise<void>;
  setNoiseFilter: (
    enabled: boolean,
    roomRef: RoomRef,
    onError: (message: string) => void,
  ) => Promise<void>;
  resetState: () => void;
};

export function useKrispFilter(): KrispFilterResult {
  const [krispSupported, setKrispSupported] = useState<boolean | null>(null);
  const [noiseFilterEnabled, setNoiseFilterEnabled] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    return readNoiseFilter(localStorage);
  });
  const [micProcessorRevision, setMicProcessorRevision] = useState(0);

  const krispProcessorRef = useRef<KrispNoiseFilterProcessor | null>(null);
  const krispTrackRef = useRef<LocalAudioTrack | null>(null);
  const krispLoadPromiseRef = useRef<Promise<boolean> | null>(null);
  const noiseFilterRef = useRef(noiseFilterEnabled);

  noiseFilterRef.current = noiseFilterEnabled;

  const ensureKrispLoaded = useCallback(() => {
    if (krispLoadPromiseRef.current !== null) return krispLoadPromiseRef.current;

    krispLoadPromiseRef.current = import("@livekit/krisp-noise-filter")
      .then(({ isKrispNoiseFilterSupported }) => {
        const supported = isKrispNoiseFilterSupported();
        setKrispSupported(supported);
        return supported;
      })
      .catch(() => {
        setKrispSupported(false);
        return false;
      });

    return krispLoadPromiseRef.current;
  }, []);

  const createKrispProcessor = useCallback(async () => {
    if (!noiseFilterRef.current) return null;

    const supported = await ensureKrispLoaded();
    if (!supported) return null;

    try {
      const { KrispNoiseFilter } = await import("@livekit/krisp-noise-filter");
      return KrispNoiseFilter();
    } catch {
      return null;
    }
  }, [ensureKrispLoaded]);

  const attachKrispNoiseFilter = useCallback(
    async (track: LocalAudioTrack) => {
      if (krispTrackRef.current && krispTrackRef.current !== track) {
        await krispTrackRef.current.stopProcessor().catch(() => undefined);
        krispProcessorRef.current = null;
        krispTrackRef.current = null;
      }

      if (!noiseFilterRef.current) return;

      const supported = await ensureKrispLoaded();
      if (!supported) return;

      if (krispProcessorRef.current) {
        try {
          await krispProcessorRef.current.setEnabled(true);
          setMicProcessorRevision((revision) => revision + 1);
        } catch {
          // KrispProcessor falhou ao ativar
        }
        return;
      }

      try {
        const { KrispNoiseFilter } = await import("@livekit/krisp-noise-filter");
        const processor = KrispNoiseFilter();
        await track.setProcessor(processor as AudioTrackProcessor);
        krispProcessorRef.current = processor;
        krispTrackRef.current = track;
        await processor.setEnabled(true);
        setMicProcessorRevision((revision) => revision + 1);
      } catch {
        // KrispProcessor falhou ao ativar
      }
    },
    [ensureKrispLoaded],
  );

  const applyInitialProcessor = useCallback(
    async (track: LocalAudioTrack, processor: KrispNoiseFilterProcessor) => {
      await track.setProcessor(processor as AudioTrackProcessor);
      krispProcessorRef.current = processor;
      krispTrackRef.current = track;
      await processor.setEnabled(true);
      setMicProcessorRevision((revision) => revision + 1);
    },
    [],
  );

  const setNoiseFilter = useCallback(
    async (enabled: boolean, roomRef: RoomRef, onError: (message: string) => void) => {
      writeNoiseFilter(typeof localStorage === "undefined" ? null : localStorage, enabled);
      setNoiseFilterEnabled(enabled);

      const track = roomRef.current?.localParticipant.getTrackPublication(
        "microphone" as import("livekit-client").Track.Source,
      )?.track as LocalAudioTrack | undefined;
      const processor = krispProcessorRef.current;
      if (processor && krispTrackRef.current === track) {
        await applyKrispToggle(processor, enabled, onError);
        setMicProcessorRevision((revision) => revision + 1);
        return;
      }

      if (!enabled) return;
      if (!track) return;
      await attachKrispNoiseFilter(track);
    },
    [attachKrispNoiseFilter],
  );

  const resetState = useCallback(() => {
    krispProcessorRef.current = null;
    krispTrackRef.current = null;
  }, []);

  return {
    krispSupported,
    noiseFilter: noiseFilterEnabled,
    micProcessorRevision,
    ensureKrispLoaded,
    createKrispProcessor,
    attachKrispNoiseFilter,
    applyInitialProcessor,
    setNoiseFilter,
    resetState,
  };
}
