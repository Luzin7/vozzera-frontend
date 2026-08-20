import { describe, expect, it } from "vitest";

import {
  audioCaptureOptions,
  audioInputDevices,
  featuredShareId,
  muteVolume,
  participantStatusLabelFor,
  readMicDeviceId,
  readNoiseFilter,
  readParticipantVolumes,
  writeMicDeviceId,
  writeNoiseFilter,
  writeParticipantVolumes,
} from "./voice";

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

    writeParticipantVolumes(storage, { luan: 0.3, ana: 1 });
    expect(readParticipantVolumes(storage)).toEqual({ luan: 0.3, ana: 1 });
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
