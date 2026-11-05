import { describe, expect, it, vi } from "vitest";

import {
  applyMicDeviceChoice,
  initialMicEnabled,
  localSpoke,
  remoteSpeakerIdentities,
  nextSpeechState,
  rmsDbFs,
  speechThresholdsFor,
  SILENT_SPEECH_STATE,
  SPEECH_ON_DB,
  SPEECH_STAY_DB,
  SPEECH_HOLD_MS,
  MIN_SENSITIVITY_DB,
  MAX_SENSITIVITY_DB,
  DEFAULT_PUSH_TO_TALK_RELEASE_DELAY_MS,
  MAX_PUSH_TO_TALK_RELEASE_DELAY_MS,
  readSpeechSensitivity,
  writeSpeechSensitivity,
  readPushToTalkReleaseDelayMs,
  writePushToTalkReleaseDelayMs,
  pushToTalkStatePayload,
  pushToTalkStateFromPayload,
  visibleMutedParticipants,
  levelToMeterPercent,
  micEnabledToRestore,
  applyVolumeWithElementMuted,
  audioCaptureOptions,
  audioInputDevices,
  deafenStateFromPayload,
  deafenStatePayload,
  effectiveParticipantVolume,
  featuredShareId,
  isParticipantLocallyInaudible,
  isParticipantMuted,
  microphoneEnabledAfterDeafenEnd,
  muteVolume,
  participantStatusLabelFor,
  readMicDeviceId,
  readNoiseFilter,
  readParticipantVolumes,
  readPushToTalkBinding,
  readPushToTalkEnabled,
  roomAudioCaptureDefaults,
  microphonePublishOptions,
  participantConnectionWarningFor,
  screenShareAdaptiveStreamSettings,
  screenShareAudioCaptureOptions,
  screenShareContentHintFor,
  screenShareHealthFor,
  screenShareHealthMessageFor,
  screenShareProfileFor,
  screenSharePublishOptions,
  canShareScreen,
  shouldHandlePushToTalk,
  pushToTalkLabelFor,
  writeMicDeviceId,
  writeNoiseFilter,
  writeParticipantVolumes,
  writePushToTalkBinding,
  writePushToTalkEnabled,
} from "./voice";
import { MicDeviceSwitchFailedError } from "./voice-errors";

describe("push to talk", () => {
  it("handles V outside editable fields", () => {
    expect(shouldHandlePushToTalk("KeyV", "KeyV", false, "DIV", false)).toBe(true);
    expect(shouldHandlePushToTalk("KeyV", "KeyV", false, undefined, false)).toBe(true);
  });

  it("ignores repeats, other keys and editable fields", () => {
    expect(shouldHandlePushToTalk("KeyV", "KeyV", true, "DIV", false)).toBe(false);
    expect(shouldHandlePushToTalk("Space", "KeyV", false, "DIV", false)).toBe(false);
    expect(shouldHandlePushToTalk("KeyV", "KeyV", false, "INPUT", false)).toBe(false);
    expect(shouldHandlePushToTalk("KeyV", "KeyV", false, "TEXTAREA", false)).toBe(false);
    expect(shouldHandlePushToTalk("KeyV", "KeyV", false, "SELECT", false)).toBe(false);
    expect(shouldHandlePushToTalk("KeyV", "KeyV", false, "DIV", true)).toBe(false);
  });

  it("handles a custom binding", () => {
    expect(shouldHandlePushToTalk("Space", "Space", false, "DIV", false)).toBe(true);
  });

  it("formats a readable key label", () => {
    expect(pushToTalkLabelFor("v", "KeyV")).toBe("V");
    expect(pushToTalkLabelFor(" ", "Space")).toBe("Espaço");
    expect(pushToTalkLabelFor("Shift", "ShiftLeft")).toBe("Shift");
  });

  it("persists the selected mode", () => {
    const storage = fakeStorage();
    expect(readPushToTalkEnabled(storage)).toBe(false);

    writePushToTalkEnabled(storage, true);
    expect(readPushToTalkEnabled(storage)).toBe(true);

    writePushToTalkEnabled(storage, false);
    expect(readPushToTalkEnabled(storage)).toBe(false);
  });

  it("persists a custom binding and defaults to V", () => {
    const storage = fakeStorage();
    expect(readPushToTalkBinding(storage)).toEqual({ code: "KeyV", label: "V" });

    writePushToTalkBinding(storage, { code: "Space", label: "Espaço" });
    expect(readPushToTalkBinding(storage)).toEqual({ code: "Space", label: "Espaço" });
  });
});

function fakeStorage(initial: Array<[string, string]> = []): Storage {
  const store = new Map<string, string>(initial);
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
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

  it("requests voice isolation off with and without a device", () => {
    expect(audioCaptureOptions(null).voiceIsolation).toBe(false);
    expect(audioCaptureOptions("mic-1").voiceIsolation).toBe(false);
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
    ["text", 3_000_000, 15, "maintain-resolution"],
    ["video", 8_000_000, 60, "maintain-framerate"],
    ["economy", 2_000_000, 30, "maintain-resolution"],
  ] as const)(
    "selects the video bitrate for %s",
    (intent, maxBitrate, maxFramerate, degradationPreference) => {
      expect(screenSharePublishOptions(intent)).toEqual({
        audioPreset: { maxBitrate: 128_000 },
        dtx: false,
        forceStereo: true,
        degradationPreference,
        screenShareEncoding: {
          maxBitrate,
          maxFramerate,
        },
        videoCodec: "h264",
        simulcast: true,
      });
    },
  );
});

describe("screenShareAdaptiveStreamSettings", () => {
  it("keeps screen share video active while the tab is hidden", () => {
    expect(screenShareAdaptiveStreamSettings()).toEqual({ pauseVideoInBackground: false });
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

describe("roomAudioCaptureDefaults", () => {
  it("matches the capture options without a device", () => {
    expect(roomAudioCaptureDefaults()).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: false,
    });
  });
});

describe("applyMicDeviceChoice", () => {
  const createStorage = () => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    } as Storage;
  };

  it("selects and persists the device without a room", async () => {
    const storage = createStorage();
    const selected: string[] = [];

    await applyMicDeviceChoice({
      deviceId: "mic-2",
      room: null,
      storage,
      onSelected: (deviceId) => selected.push(deviceId),
    });

    expect(selected).toEqual(["mic-2"]);
    expect(readMicDeviceId(storage)).toBe("mic-2");
  });

  it("keeps selection and storage untouched when the switch rejects", async () => {
    const storage = createStorage();
    const onSelected = vi.fn();
    const switchActiveDevice = vi.fn().mockRejectedValue(new Error("switch failed"));

    await expect(
      applyMicDeviceChoice({
        deviceId: "mic-4",
        room: { switchActiveDevice },
        storage,
        onSelected,
      }),
    ).rejects.toThrow("switch failed");

    expect(onSelected).not.toHaveBeenCalled();
    expect(readMicDeviceId(storage)).toBeNull();
  });

  it("fails and keeps selection and storage untouched when the switch resolves false", async () => {
    const storage = createStorage();
    const onSelected = vi.fn();
    const switchActiveDevice = vi.fn().mockResolvedValue(false);

    await expect(
      applyMicDeviceChoice({
        deviceId: "mic-5",
        room: { switchActiveDevice },
        storage,
        onSelected,
      }),
    ).rejects.toBeInstanceOf(MicDeviceSwitchFailedError);

    expect(onSelected).not.toHaveBeenCalled();
    expect(readMicDeviceId(storage)).toBeNull();
  });

  it("switches the active device when a room exists", async () => {
    const storage = createStorage();
    const switchActiveDevice = vi.fn().mockResolvedValue(true);

    await applyMicDeviceChoice({
      deviceId: "mic-3",
      room: { switchActiveDevice },
      storage,
      onSelected: () => undefined,
    });

    expect(switchActiveDevice).toHaveBeenCalledWith("audioinput", "mic-3");
    expect(readMicDeviceId(storage)).toBe("mic-3");
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

describe("effectiveParticipantVolume", () => {
  it("uses the default volume without a saved preference", () => {
    expect(effectiveParticipantVolume(undefined)).toBe(1);
  });

  it("uses the saved participant volume", () => {
    expect(effectiveParticipantVolume(0.4)).toBe(0.4);
  });
});

describe("isParticipantLocallyInaudible", () => {
  it("marks an individually muted remote participant as inaudible", () => {
    expect(isParticipantLocallyInaudible(false, 0)).toBe(true);
  });

  it("does not show the local indicator on the current user", () => {
    expect(isParticipantLocallyInaudible(true, 0)).toBe(false);
  });
});

describe("microphoneEnabledAfterDeafenEnd", () => {
  it("restores the previous microphone state", () => {
    expect(microphoneEnabledAfterDeafenEnd(false, true)).toBe(true);
    expect(microphoneEnabledAfterDeafenEnd(false, false)).toBe(false);
  });

  it("keeps the microphone off while push-to-talk is enabled", () => {
    expect(microphoneEnabledAfterDeafenEnd(true, true)).toBe(false);
  });
});

describe("deafen state payload", () => {
  it("round-trips an enabled state", () => {
    expect(deafenStateFromPayload(deafenStatePayload(true))).toBe(true);
  });

  it("round-trips a disabled state", () => {
    expect(deafenStateFromPayload(deafenStatePayload(false))).toBe(false);
  });

  it("rejects an invalid payload", () => {
    expect(deafenStateFromPayload(new Uint8Array([2]))).toBeNull();
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

describe("applyVolumeWithElementMuted", () => {
  it("sets element volume to 0 before applyVolume and restores to 1 after", () => {
    const volumes: number[] = [];
    const element = { volume: 0.5 } as HTMLAudioElement;

    applyVolumeWithElementMuted(element, () => {
      volumes.push(element.volume);
    });

    expect(volumes).toEqual([0]);
    expect(element.volume).toBe(1);
  });
});

describe("screenShareContentHintFor", () => {
  it("uses detail for the sharpness mode", () => {
    expect(screenShareContentHintFor("maintain-resolution")).toBe("detail");
  });

  it("uses motion for the fluidity mode", () => {
    expect(screenShareContentHintFor("maintain-framerate")).toBe("motion");
  });
});

describe("screenShareProfileFor", () => {
  it("derives capture, encoding, degradation, hint and surface from the intent", () => {
    expect(screenShareProfileFor("text")).toEqual({
      constraints: { width: 1920, height: 1080, frameRate: 15 },
      encoding: { maxBitrate: 3_000_000, maxFramerate: 15 },
      degradationPreference: "maintain-resolution",
      contentHint: "detail",
      displaySurface: "window",
    });
  });

  it("asks for a window surface to avoid capturing the whole screen", () => {
    expect(screenShareProfileFor("video")).toEqual({
      constraints: { width: 1920, height: 1080, frameRate: 60 },
      encoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
      degradationPreference: "maintain-framerate",
      contentHint: "motion",
      displaySurface: "window",
    });
    expect(screenShareProfileFor("economy").displaySurface).toBe("window");
  });
});

describe("screenShareHealthFor", () => {
  it("reports cpu when the encoder is limited by cpu", () => {
    expect(screenShareHealthFor({ qualityLimitationReason: "cpu" })).toBe("cpu");
  });

  it("reports bandwidth when the encoder is limited by bandwidth", () => {
    expect(screenShareHealthFor({ qualityLimitationReason: "bandwidth" })).toBe("bandwidth");
  });

  it("reports ok otherwise", () => {
    expect(screenShareHealthFor({})).toBe("ok");
    expect(screenShareHealthFor({ qualityLimitationReason: "none" })).toBe("ok");
  });

  it("reports paused when the stream was suspended", () => {
    expect(screenShareHealthFor({ paused: true })).toBe("paused");
    expect(screenShareHealthFor({ paused: true, qualityLimitationReason: "cpu" })).toBe("paused");
  });
});

describe("screenShareHealthMessageFor", () => {
  it("explains each unhealthy state in pt-BR", () => {
    expect(screenShareHealthMessageFor("cpu")).toBe("Seu computador está no limite.");
    expect(screenShareHealthMessageFor("bandwidth")).toBe(
      "Sua internet de upload está limitando a qualidade.",
    );
    expect(screenShareHealthMessageFor("paused")).toBe(
      "Sua conexão não está dando conta. A transmissão volta sozinha.",
    );
  });

  it("stays silent when the stream is healthy", () => {
    expect(screenShareHealthMessageFor("ok")).toBeNull();
  });
});

describe("participantConnectionWarningFor", () => {
  it("warns when the remote sharer has a poor connection", () => {
    expect(participantConnectionWarningFor("poor", "ana")).toBe("A conexão de ana está instável.");
  });

  it("stays silent for good, excellent, unknown or missing quality", () => {
    expect(participantConnectionWarningFor("good", "ana")).toBeNull();
    expect(participantConnectionWarningFor("excellent", "ana")).toBeNull();
    expect(participantConnectionWarningFor(undefined, "ana")).toBeNull();
  });
});

describe("canShareScreen", () => {
  it("accepts devices that expose getDisplayMedia", () => {
    expect(canShareScreen({ getDisplayMedia: () => Promise.resolve() })).toBe(true);
  });

  it("rejects missing devices or devices without the API", () => {
    expect(canShareScreen(null)).toBe(false);
    expect(canShareScreen(undefined)).toBe(false);
    expect(canShareScreen({})).toBe(false);
  });
});

describe("isParticipantMuted", () => {
  const mutedParticipants = { "id-bia": true };

  it("uses the local microphone for the current user", () => {
    expect(
      isParticipantMuted({
        identity: "id-luan",
        isLocal: true,
        micEnabled: false,
        mutedParticipants,
      }),
    ).toBe(true);
    expect(
      isParticipantMuted({
        identity: "id-luan",
        isLocal: true,
        micEnabled: true,
        mutedParticipants,
      }),
    ).toBe(false);
  });

  it("uses the remote mute state for everyone else, keyed by identity", () => {
    expect(
      isParticipantMuted({
        identity: "id-bia",
        isLocal: false,
        micEnabled: true,
        mutedParticipants,
      }),
    ).toBe(true);
    expect(
      isParticipantMuted({
        identity: "id-caio",
        isLocal: false,
        micEnabled: true,
        mutedParticipants,
      }),
    ).toBe(false);
  });
});

describe("initialMicEnabled", () => {
  it("is on by default", () => {
    expect(initialMicEnabled(false, undefined)).toBe(true);
  });

  it("restores a requested state", () => {
    expect(initialMicEnabled(false, false)).toBe(false);
    expect(initialMicEnabled(false, true)).toBe(true);
  });

  it("stays off with push-to-talk", () => {
    expect(initialMicEnabled(true, undefined)).toBe(false);
    expect(initialMicEnabled(true, true)).toBe(false);
  });
});

describe("micEnabledToRestore", () => {
  it("uses the live mic state when not deafened", () => {
    expect(micEnabledToRestore({ deafen: false, micBeforeDeafen: true, micOn: false })).toBe(false);
    expect(micEnabledToRestore({ deafen: false, micBeforeDeafen: false, micOn: true })).toBe(true);
  });

  it("uses the state from before the deafen when deafened", () => {
    expect(micEnabledToRestore({ deafen: true, micBeforeDeafen: true, micOn: false })).toBe(true);
    expect(micEnabledToRestore({ deafen: true, micBeforeDeafen: false, micOn: false })).toBe(false);
  });
});

describe("localSpoke", () => {
  it("detects the local identity in the raw speaker list", () => {
    expect(localSpoke(["a", "me"], "me")).toBe(true);
    expect(localSpoke(["a"], "me")).toBe(false);
    expect(localSpoke([], "me")).toBe(false);
  });
});

describe("remoteSpeakerIdentities", () => {
  it("drops the local identity from the server speaker list", () => {
    expect(remoteSpeakerIdentities(["a", "me"], "me")).toEqual(["a"]);
    expect(remoteSpeakerIdentities(["a"], "me")).toEqual(["a"]);
  });
});

describe("rmsDbFs", () => {
  it("is -Infinity for digital silence and for no samples", () => {
    expect(rmsDbFs(new Float32Array(128))).toBe(-Infinity);
    expect(rmsDbFs(new Float32Array(0))).toBe(-Infinity);
  });

  it("is 0 dBFS for a full-scale square wave", () => {
    expect(rmsDbFs(new Float32Array(128).fill(1))).toBeCloseTo(0, 5);
  });

  it("is about -20 dBFS at a tenth of full scale", () => {
    expect(rmsDbFs(new Float32Array(128).fill(0.1))).toBeCloseTo(-20, 5);
  });
});

describe("nextSpeechState", () => {
  const thresholds = { onDb: SPEECH_ON_DB, stayDb: SPEECH_STAY_DB };

  it("starts speaking on the first frame at the on threshold", () => {
    expect(nextSpeechState(SILENT_SPEECH_STATE, SPEECH_ON_DB, 1000, thresholds)).toEqual({
      active: true,
      lastLoudAt: 1000,
    });
  });

  it("does not start just below the on threshold", () => {
    expect(nextSpeechState(SILENT_SPEECH_STATE, SPEECH_ON_DB - 0.1, 1000, thresholds)).toEqual(
      SILENT_SPEECH_STATE,
    );
  });

  it("stays speaking between the stay and on thresholds and refreshes the hold", () => {
    const speaking = { active: true, lastLoudAt: 1000 };
    expect(nextSpeechState(speaking, SPEECH_STAY_DB, 1100, thresholds)).toEqual({
      active: true,
      lastLoudAt: 1100,
    });
  });

  it("holds through quiet frames shorter than the hold time", () => {
    const speaking = { active: true, lastLoudAt: 1000 };
    expect(nextSpeechState(speaking, -90, 1000 + SPEECH_HOLD_MS - 1, thresholds)).toBe(speaking);
  });

  it("stops once the hold time passed in silence", () => {
    const speaking = { active: true, lastLoudAt: 1000 };
    expect(nextSpeechState(speaking, -90, 1000 + SPEECH_HOLD_MS, thresholds)).toEqual(
      SILENT_SPEECH_STATE,
    );
  });

  it("stops when the signal falls under the stay threshold after the hold", () => {
    const speaking = { active: true, lastLoudAt: 1000 };
    expect(nextSpeechState(speaking, SPEECH_STAY_DB - 0.1, 1300, thresholds)).toEqual(
      SILENT_SPEECH_STATE,
    );
  });
});

describe("speechThresholdsFor", () => {
  it("uses the automatic constants", () => {
    expect(speechThresholdsFor({ auto: true, thresholdDb: -30 })).toEqual({
      onDb: SPEECH_ON_DB,
      stayDb: SPEECH_STAY_DB,
    });
  });

  it("maps the manual level to on, with stay 5 dB below", () => {
    expect(speechThresholdsFor({ auto: false, thresholdDb: -40 })).toEqual({
      onDb: -40,
      stayDb: -45,
    });
  });

  it("clamps the manual level to the slider range", () => {
    expect(speechThresholdsFor({ auto: false, thresholdDb: -120 }).onDb).toBe(MIN_SENSITIVITY_DB);
    expect(speechThresholdsFor({ auto: false, thresholdDb: -5 }).onDb).toBe(MAX_SENSITIVITY_DB);
  });
});

describe("levelToMeterPercent", () => {
  it("maps the slider range onto 0-100", () => {
    expect(levelToMeterPercent(MIN_SENSITIVITY_DB)).toBe(0);
    expect(levelToMeterPercent(MAX_SENSITIVITY_DB)).toBe(100);
    expect(levelToMeterPercent(-50)).toBe(50);
    expect(levelToMeterPercent(-Infinity)).toBe(0);
    expect(levelToMeterPercent(0)).toBe(100);
  });
});

describe("speech sensitivity storage", () => {
  it("defaults to automatic", () => {
    expect(readSpeechSensitivity(fakeStorage())).toEqual({ auto: true, thresholdDb: SPEECH_ON_DB });
    expect(readSpeechSensitivity(null)).toEqual({ auto: true, thresholdDb: SPEECH_ON_DB });
  });

  it("round-trips a manual level", () => {
    const storage = fakeStorage();
    writeSpeechSensitivity(storage, { auto: false, thresholdDb: -35 });
    expect(readSpeechSensitivity(storage)).toEqual({ auto: false, thresholdDb: -35 });
  });

  it("ignores a corrupt level", () => {
    const storage = fakeStorage([["vozzera.speechSensitivityDb", "abc"]]);
    expect(readSpeechSensitivity(storage).thresholdDb).toBe(SPEECH_ON_DB);
  });
});

describe("push to talk release delay", () => {
  it("defaults to 200 ms", () => {
    expect(DEFAULT_PUSH_TO_TALK_RELEASE_DELAY_MS).toBe(200);
    expect(readPushToTalkReleaseDelayMs(fakeStorage())).toBe(200);
  });

  it("round-trips and clamps to 0-2000 ms", () => {
    const storage = fakeStorage();
    writePushToTalkReleaseDelayMs(storage, 750);
    expect(readPushToTalkReleaseDelayMs(storage)).toBe(750);
    writePushToTalkReleaseDelayMs(storage, 9000);
    expect(readPushToTalkReleaseDelayMs(storage)).toBe(MAX_PUSH_TO_TALK_RELEASE_DELAY_MS);
    writePushToTalkReleaseDelayMs(storage, 0);
    expect(readPushToTalkReleaseDelayMs(storage)).toBe(0);
  });
});

describe("push to talk state payload", () => {
  it("round-trips both states", () => {
    expect(pushToTalkStateFromPayload(pushToTalkStatePayload(true))).toBe(true);
    expect(pushToTalkStateFromPayload(pushToTalkStatePayload(false))).toBe(false);
  });

  it("rejects malformed payloads from other versions", () => {
    expect(pushToTalkStateFromPayload(new Uint8Array([]))).toBeNull();
    expect(pushToTalkStateFromPayload(new Uint8Array([2]))).toBeNull();
    expect(pushToTalkStateFromPayload(new Uint8Array([1, 1]))).toBeNull();
  });
});

describe("visibleMutedParticipants", () => {
  it("hides the muted icon for people idle in push-to-talk", () => {
    expect(visibleMutedParticipants({ ana: true, beto: true, caio: false }, { ana: true })).toEqual(
      { ana: false, beto: true, caio: false },
    );
  });

  it("returns the same object when nobody is in push-to-talk", () => {
    const muted = { ana: true };
    expect(visibleMutedParticipants(muted, {})).toBe(muted);
  });
});
