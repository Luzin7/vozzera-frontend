import { describe, expect, it } from "vitest";

import {
  applyVideoPlaybackDelay,
  applyVolumeWithElementMuted,
  audioCaptureOptions,
  audioInputDevices,
  effectiveParticipantVolume,
  featuredShareId,
  isGlobalMuteActive,
  isLocalVoiceActive,
  isParticipantLocallyInaudible,
  locallyMutedParticipantNames,
  mergeActiveSpeakerNames,
  microphoneEnabledAfterDeafenToggle,
  muteVolume,
  participantNamesToMuteForSelectiveListening,
  participantStatusLabelFor,
  readMicDeviceId,
  readNoiseFilter,
  readParticipantVolumes,
  readPushToTalkBinding,
  readPushToTalkEnabled,
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
  shouldReleaseMicrophoneInBackground,
  shouldShowLocalVoiceActivity,
  shouldHandlePushToTalk,
  pushToTalkLabelFor,
  VIDEO_PLAYBACK_DELAY_MS,
  writeMicDeviceId,
  writeNoiseFilter,
  writeParticipantVolumes,
  writePushToTalkBinding,
  writePushToTalkEnabled,
} from "./voice";

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
    expect(shouldShowLocalVoiceActivity(false, true, 39)).toBe(true);
  });

  it("hides the indicator after 40 milliseconds of continuous silence", () => {
    expect(shouldShowLocalVoiceActivity(false, true, 40)).toBe(false);
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

describe("shouldReleaseMicrophoneInBackground", () => {
  it("releases the microphone when the page goes to the background", () => {
    expect(shouldReleaseMicrophoneInBackground(true)).toBe(true);
  });

  it("keeps the microphone while the page is visible", () => {
    expect(shouldReleaseMicrophoneInBackground(false)).toBe(false);
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
  it("mutes participant audio while deafen is active", () => {
    expect(effectiveParticipantVolume(true, 0.4)).toBe(0);
  });

  it("restores the default volume after deafen without a saved preference", () => {
    expect(effectiveParticipantVolume(false, undefined)).toBe(1);
  });

  it("restores the saved participant volume after deafen", () => {
    expect(effectiveParticipantVolume(false, 0.4)).toBe(0.4);
  });
});

describe("isParticipantLocallyInaudible", () => {
  it("marks remote participants as inaudible while deafen is active", () => {
    expect(isParticipantLocallyInaudible(false, true, 1)).toBe(true);
  });

  it("marks an individually muted remote participant as inaudible", () => {
    expect(isParticipantLocallyInaudible(false, false, 0)).toBe(true);
  });

  it("does not show the local indicator on the current user", () => {
    expect(isParticipantLocallyInaudible(true, true, 0)).toBe(false);
  });
});

describe("participantNamesToMuteForSelectiveListening", () => {
  it("keeps only the selected participant audible", () => {
    expect(participantNamesToMuteForSelectiveListening(["ana", "beto", "caio"], "beto")).toEqual([
      "ana",
      "caio",
    ]);
  });
});

describe("microphoneEnabledAfterDeafenToggle", () => {
  it("mutes the microphone when deafen is activated", () => {
    expect(microphoneEnabledAfterDeafenToggle(false)).toBe(false);
  });

  it("always enables the microphone when deafen is disabled globally", () => {
    expect(microphoneEnabledAfterDeafenToggle(true)).toBe(true);
  });
});

describe("locallyMutedParticipantNames", () => {
  it("selects only participants with volume zero", () => {
    expect(locallyMutedParticipantNames({ ana: 0, beto: 0.7, caio: 0 })).toEqual(["ana", "caio"]);
  });
});

describe("isGlobalMuteActive", () => {
  it("recognizes locally muted participants and microphone as global mute", () => {
    expect(isGlobalMuteActive(false, ["ana", "beto"], { ana: 0, beto: 0 }, [], {})).toBe(true);
  });

  it("stays inactive while the microphone is enabled", () => {
    expect(isGlobalMuteActive(true, ["ana"], { ana: 0 }, [], {})).toBe(false);
  });

  it("stays inactive while a participant is audible", () => {
    expect(isGlobalMuteActive(false, ["ana", "beto"], { ana: 0, beto: 0.8 }, [], {})).toBe(false);
  });

  it("stays inactive while a screen share is audible", () => {
    expect(isGlobalMuteActive(false, ["ana"], { ana: 0 }, ["ana"], { ana: 0.8 })).toBe(false);
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

describe("applyVideoPlaybackDelay", () => {
  it("sets playout delay in seconds on a track", () => {
    let capturedDelay = 0;
    const fakeTrack = {
      setPlayoutDelay(delayInSeconds: number) {
        capturedDelay = delayInSeconds;
      },
    };

    applyVideoPlaybackDelay(fakeTrack, VIDEO_PLAYBACK_DELAY_MS);

    expect(capturedDelay).toBe(VIDEO_PLAYBACK_DELAY_MS / 1000);
  });

  it("converts 500ms to 0.5 seconds", () => {
    let capturedDelay = 0;
    const fakeTrack = {
      setPlayoutDelay(delayInSeconds: number) {
        capturedDelay = delayInSeconds;
      },
    };

    applyVideoPlaybackDelay(fakeTrack, 500);

    expect(capturedDelay).toBe(0.5);
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
