import { SPEECH_BAND_HIGH_HZ, SPEECH_BAND_LOW_HZ, rmsDbFs } from "./voice";
import type { SpeechTap } from "./speaking-monitor";

const ANALYSER_FFT_SIZE = 1024;

type WebAudioPluginTrack = { setWebAudioPlugins: (nodes: AudioNode[]) => void };

function createSpeechBandAnalyser(context: AudioContext) {
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = SPEECH_BAND_LOW_HZ;
  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = SPEECH_BAND_HIGH_HZ;
  const analyser = context.createAnalyser();
  analyser.fftSize = ANALYSER_FFT_SIZE;
  highPass.connect(lowPass);
  lowPass.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  return {
    input: highPass,
    readDb: () => {
      analyser.getFloatTimeDomainData(samples);
      return rmsDbFs(samples);
    },
    disconnect: () => {
      highPass.disconnect();
      lowPass.disconnect();
      analyser.disconnect();
    },
  };
}

export function createLocalSpeechTap(context: AudioContext, micTrack: MediaStreamTrack): SpeechTap {
  const source = context.createMediaStreamSource(new MediaStream([micTrack]));
  const band = createSpeechBandAnalyser(context);
  source.connect(band.input);
  return {
    readDb: band.readDb,
    dispose: () => {
      source.disconnect();
      band.disconnect();
    },
  };
}

function supportsWebAudioPlugins(track: unknown): track is WebAudioPluginTrack {
  if (typeof track !== "object" || track === null) return false;
  return typeof (track as Partial<WebAudioPluginTrack>).setWebAudioPlugins === "function";
}

export function attachRemoteSpeechTap(context: AudioContext, track: unknown): SpeechTap | null {
  if (!supportsWebAudioPlugins(track)) return null;
  const tapNode = context.createGain();
  const band = createSpeechBandAnalyser(context);
  tapNode.connect(band.input);
  track.setWebAudioPlugins([tapNode]);
  return {
    readDb: band.readDb,
    dispose: () => {
      tapNode.disconnect(band.input);
      band.disconnect();
    },
  };
}

export const MIC_TRACK_RESTARTED_EVENT = "restarted" as const;

type RestartEmitter = {
  on(event: typeof MIC_TRACK_RESTARTED_EVENT, listener: () => void): unknown;
  off(event: typeof MIC_TRACK_RESTARTED_EVENT, listener: () => void): unknown;
};

export function onMicTrackRestarted(track: RestartEmitter, listener: () => void): () => void {
  track.on(MIC_TRACK_RESTARTED_EVENT, listener);
  return () => {
    track.off(MIC_TRACK_RESTARTED_EVENT, listener);
  };
}
