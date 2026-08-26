import { describe, expect, it } from "vitest";

import {
  audioCaptureOptions,
  audioInputDevices,
  featuredShareId,
  isLocalVoiceActive,
  mergeActiveSpeakerNames,
  muteVolume,
  participantStatusLabelFor,
  readMicDeviceId,
  readNoiseFilter,
  readParticipantVolumes,
  microphonePublishOptions,
  screenShareAudioCaptureOptions,
  screenSharePublishOptions,
  shouldShowLocalVoiceActivity,
  writeMicDeviceId,
  writeNoiseFilter,
  writeParticipantVolumes,
} from "./voice";

describe("isLocalVoiceActive", () => {
  it("starts immediately when voice crosses the activation level", () => {
    expect(isLocalVoiceActive(0.159, false)).toBe(false);
    expect(isLocalVoiceActive(0.16, false)).toBe(true);
  });

  it("uses hysteresis to avoid flickering between syllables", () => {
    expect(isLocalVoiceActive(0.08, true)).toBe(true);
    expect(isLocalVoiceActive(0.069, true)).toBe(false);
  });
});

describe("shouldShowLocalVoiceActivity", () => {
  it("keeps the indicator visible during short pauses", () => {
    expect(shouldShowLocalVoiceActivity(false, true, 149)).toBe(true);
  });

  it("hides the indicator after 150 milliseconds of continuous silence", () => {
    expect(shouldShowLocalVoiceActivity(false, true, 150)).toBe(false);
  });

  it("shows voice immediately and does not delay the initial activation", () => {
    expect(shouldShowLocalVoiceActivity(true, false, 0)).toBe(true);
    expect(shouldShowLocalVoiceActivity(false, false, 0)).toBe(false);
  });
});

describe("mergeActiveSpeakerNames", () => {
  it("keeps releasing speakers while adding active speakers without duplicates", () => {
    expect(mergeActiveSpeakerNames(["ana", "beto"], ["beto", "caio"])).toEqual([
      "ana",
      "beto",
      "caio",
    ]);
  });
});

function fakeStorage(initial: Array<[string, string]> = []): Storage {
  const store = new Map<string, string>(initial);
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as Storage;
}

describe("readParticipantVolumes / writeParticipantVolumes", () => {
  it("defaults to an empty map without storage", () => {
    expect(readParticipantVolumes(null)).toEqual({});
  });

  it("persists and reads volumes back", () => {
    const storage = fakeStorage();

    expect(readParticipantVolumes(storage)).toEqual({});

    writeParticipantVolumes(storage, { luan: 0.3, ana: 1.5 });
    expect(readParticipantVolumes(storage)).toEqual({ luan: 0.3, ana: 1.5 });
  });

  it("returns an empty map for corrupt data", () => {
    const storage = fakeStorage([["vozzera.participantVolumes", "nope"]]);

    expect(readParticipantVolumes(storage)).toEqual({});
  });

  it("returns an empty map for invalid volume values", () => {
    const storage = fakeStorage([["vozzera.participantVolumes", JSON.stringify({ luan: 5 })]]);

    expect(readParticipantVolumes(storage)).toEqual({});
  });
});

describe("audioCaptureOptions", () => {
  it("always enables echo cancellation, noise suppression and auto gain", () => {
    expect(audioCaptureOptions(null)).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
  });

  it("adds the device id only when selected", () => {
    expect(audioCaptureOptions("mic-1").deviceId).toBe("mic-1");
    expect(audioCaptureOptions(null).deviceId).toBeUndefined();
  });
});

describe("microphonePublishOptions", () => {
  it("publishes mono voice at 70 kbps with DTX", () => {
    expect(microphonePublishOptions()).toEqual({
      audioPreset: { maxBitrate: 70_000 },
      dtx: true,
      forceStereo: false,
    });
  });
});

describe("screenShareAudioCaptureOptions", () => {
  it("captures stereo media without voice processing", () => {
    expect(screenShareAudioCaptureOptions()).toEqual({
      channelCount: 2,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      restrictOwnAudio: true,
    });
  });
});

describe("screenSharePublishOptions", () => {
  it.each([
    [{ width: 1280, height: 720, frameRate: 30 }, 4_000_000],
    [{ width: 1280, height: 720, frameRate: 60 }, 6_000_000],
    [{ width: 1920, height: 1080, frameRate: 30 }, 6_000_000],
    [{ width: 1920, height: 1080, frameRate: 60 }, 10_000_000],
  ])("selects the video bitrate for %o", (quality, maxBitrate) => {
    expect(screenSharePublishOptions(quality)).toEqual({
      audioPreset: { maxBitrate: 128_000 },
      dtx: false,
      forceStereo: true,
      degradationPreference: "maintain-framerate",
      screenShareEncoding: {
        maxBitrate,
        maxFramerate: quality.frameRate,
      },
    });
  });
});

describe("readNoiseFilter / writeNoiseFilter", () => {
  it("defaults to enabled without storage", () => {
    expect(readNoiseFilter(null)).toBe(true);
  });

  it("persists the choice", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    } as Storage;

    writeNoiseFilter(storage, false);
    expect(readNoiseFilter(storage)).toBe(false);

    writeNoiseFilter(storage, true);
    expect(readNoiseFilter(storage)).toBe(true);
  });
});

describe("readMicDeviceId / writeMicDeviceId", () => {
  it("defaults to null without storage", () => {
    expect(readMicDeviceId(null)).toBeNull();
  });

  it("persists the device id", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    } as Storage;

    expect(readMicDeviceId(storage)).toBeNull();

    writeMicDeviceId(storage, "mic-9");
    expect(readMicDeviceId(storage)).toBe("mic-9");
  });
});

describe("audioInputDevices", () => {
  it("filters audio inputs and labels the ones without a name", () => {
    const devices = [
      { kind: "audioinput", deviceId: "a", label: "USB Mic" },
      { kind: "videoinput", deviceId: "v", label: "Webcam" },
      { kind: "audioinput", deviceId: "b", label: "" },
    ] as MediaDeviceInfo[];

    expect(audioInputDevices(devices)).toEqual([
      { deviceId: "a", label: "USB Mic" },
      { deviceId: "b", label: "Microfone padrão" },
    ]);
  });
});

describe("featuredShareId", () => {
  it("returns null with no shares", () => {
    expect(featuredShareId(null, [])).toBeNull();
  });

  it("features the first share without a selection", () => {
    expect(featuredShareId(null, [{ id: "a" }, { id: "b" }])).toBe("a");
  });

  it("keeps the selection while it still exists", () => {
    expect(featuredShareId("b", [{ id: "a" }, { id: "b" }])).toBe("b");
  });

  it("falls back to the first share when the selection leaves", () => {
    expect(featuredShareId("c", [{ id: "a" }, { id: "b" }])).toBe("a");
  });
});

describe("muteVolume", () => {
  it("mutes to zero", () => {
    expect(muteVolume(true, undefined)).toBe(0);
  });

  it("restores the default volume without a previous value", () => {
    expect(muteVolume(false, undefined)).toBe(1);
  });

  it("restores the previous volume when unmuting", () => {
    expect(muteVolume(false, 0.4)).toBe(0.4);
  });
});

describe("participantStatusLabelFor", () => {
  it("labels a locally muted participant", () => {
    expect(participantStatusLabelFor(true, false)).toBe("Silenciado para você");
  });

  it("labels a speaking participant", () => {
    expect(participantStatusLabelFor(false, true)).toBe("Falando agora");
  });

  it("labels a neutral participant", () => {
    expect(participantStatusLabelFor(false, false)).toBe("Volume individual");
  });
});
