import { describe, expect, it } from "vitest";

import {
  audioCaptureOptions,
  audioInputDevices,
  readMicDeviceId,
  readNoiseFilter,
  writeMicDeviceId,
  writeNoiseFilter,
} from "./voice";

describe("audioCaptureOptions", () => {
  it("always enables echo cancellation and auto gain", () => {
    expect(audioCaptureOptions(true, null)).toMatchObject({
      echoCancellation: true,
      autoGainControl: true,
    });
  });

  it("reflects the noise filter choice", () => {
    expect(audioCaptureOptions(true, null).noiseSuppression).toBe(true);
    expect(audioCaptureOptions(false, null).noiseSuppression).toBe(false);
  });

  it("adds the device id only when selected", () => {
    expect(audioCaptureOptions(true, "mic-1").deviceId).toBe("mic-1");
    expect(audioCaptureOptions(true, null).deviceId).toBeUndefined();
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
