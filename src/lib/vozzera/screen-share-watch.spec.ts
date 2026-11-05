import { describe, expect, it, vi } from "vitest";

import {
  addWatchIntent,
  applyWatchIntentToParticipant,
  deriveAvailableShares,
  applyWatchIntent,
  removeWatchIntent,
  shouldAcceptSubscribedShare,
  shouldSubscribe,
} from "./screen-share-watch";
import type { ShareParticipantContract, SharePublicationContract } from "./screen-share-watch";

function makePublication(
  source: string,
  overrides: Partial<SharePublicationContract> = {},
): SharePublicationContract {
  return { source, setSubscribed: vi.fn(), ...overrides };
}

function makeParticipant(
  publications: SharePublicationContract[],
  overrides: Partial<ShareParticipantContract> = {},
): ShareParticipantContract {
  return {
    identity: "ana-id",
    name: "Ana",
    trackPublications: new Map(publications.map((pub, index) => [String(index), pub])),
    ...overrides,
  };
}

describe("shouldSubscribe", () => {
  it("is false without intent", () => {
    expect(shouldSubscribe("ana-id", new Set())).toBe(false);
  });

  it("is true for an opted-in identity", () => {
    expect(shouldSubscribe("ana-id", new Set(["ana-id"]))).toBe(true);
  });

  it("is false for another identity", () => {
    expect(shouldSubscribe("bia-id", new Set(["ana-id"]))).toBe(false);
  });
});

describe("watch intents", () => {
  it("adds without mutating the original", () => {
    const original = new Set<string>();
    const next = addWatchIntent(original, "ana-id");
    expect(next.has("ana-id")).toBe(true);
    expect(original.size).toBe(0);
  });

  it("removes without mutating the original", () => {
    const original = new Set(["ana-id", "bia-id"]);
    const next = removeWatchIntent(original, "ana-id");
    expect([...next]).toEqual(["bia-id"]);
    expect(original.size).toBe(2);
  });
});

describe("shouldAcceptSubscribedShare", () => {
  it("rejects a share delivered without intent", () => {
    expect(shouldAcceptSubscribedShare("ana-id", new Set())).toBe(false);
  });

  it("accepts a share from an opted-in identity", () => {
    expect(shouldAcceptSubscribedShare("ana-id", new Set(["ana-id"]))).toBe(true);
  });
});

describe("applyWatchIntent", () => {
  it("subscribes a just-republished share of an opted-in identity", () => {
    const republished = makePublication("screen_share");

    applyWatchIntent("ana-id", republished, new Set(["ana-id"]));

    expect(republished.setSubscribed).toHaveBeenCalledWith(true);
  });
});

describe("applyWatchIntentToParticipant", () => {
  it("unsubscribes screen share video and audio without intent", () => {
    const video = makePublication("screen_share");
    const audio = makePublication("screen_share_audio");

    applyWatchIntentToParticipant(makeParticipant([video, audio]), new Set());

    expect(video.setSubscribed).toHaveBeenCalledWith(false);
    expect(audio.setSubscribed).toHaveBeenCalledWith(false);
  });

  it("subscribes screen share video and audio with intent", () => {
    const video = makePublication("screen_share");
    const audio = makePublication("screen_share_audio");

    applyWatchIntentToParticipant(makeParticipant([video, audio]), new Set(["ana-id"]));

    expect(video.setSubscribed).toHaveBeenCalledWith(true);
    expect(audio.setSubscribed).toHaveBeenCalledWith(true);
  });

  it("never touches microphone or camera publications", () => {
    const mic = makePublication("microphone");
    const camera = makePublication("camera");

    applyWatchIntentToParticipant(makeParticipant([mic, camera]), new Set());

    expect(mic.setSubscribed).not.toHaveBeenCalled();
    expect(camera.setSubscribed).not.toHaveBeenCalled();
  });
});

describe("deriveAvailableShares", () => {
  it("lists participants publishing a screen share, using the name", () => {
    const sharer = makeParticipant([makePublication("screen_share")]);
    const listener = makeParticipant([makePublication("microphone")], {
      identity: "bia-id",
      name: "Bia",
    });

    expect(deriveAvailableShares([sharer, listener])).toEqual([
      { identity: "ana-id", name: "Ana" },
    ]);
  });

  it("falls back to the identity when the name is empty", () => {
    const sharer = makeParticipant([makePublication("screen_share")], { name: "" });

    expect(deriveAvailableShares([sharer])).toEqual([{ identity: "ana-id", name: "ana-id" }]);
  });

  it("ignores a participant with only screen share audio", () => {
    const audioOnly = makeParticipant([makePublication("screen_share_audio")]);

    expect(deriveAvailableShares([audioOnly])).toEqual([]);
  });
});
