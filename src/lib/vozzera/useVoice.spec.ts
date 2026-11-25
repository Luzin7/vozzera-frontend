// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stopIdleDetection } from "@/lib/vozzera/idle-detection";
import type { VoiceLeave } from "@/lib/vozzera/types";
import { useVoice } from "@/lib/vozzera/useVoice";

const fakeLiveKit = vi.hoisted(() => {
  type FakeRoomOptions = { disconnectOnPageLeave?: boolean };

  class FakeRoom {
    static instances: FakeRoom[] = [];

    remoteParticipants = new Map<string, never>();
    localParticipant = {
      sid: "PA_local",
      identity: "me",
      name: "me",
      createTracks: async () => [{ setAudioContext: () => undefined, stop: () => undefined }],
      publishTrack: async () => undefined,
      publishData: async () => undefined,
      setMicrophoneEnabled: async () => undefined,
      getTrackPublication: () => undefined,
      on: () => undefined,
      off: () => undefined,
    };
    connect = vi.fn(async () => undefined);
    disconnect = vi.fn(async () => undefined);

    constructor(readonly options: FakeRoomOptions) {
      FakeRoom.instances.push(this);
    }

    static created(): FakeRoom {
      const [room] = FakeRoom.instances;
      if (!room) throw new Error("useVoice did not create a room");
      return room;
    }

    on() {
      return this;
    }

    off() {
      return this;
    }
  }

  return { FakeRoom };
});

vi.mock("livekit-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("livekit-client")>();
  return { ...actual, Room: fakeLiveKit.FakeRoom };
});

vi.mock("@/lib/vozzera/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vozzera/api")>();
  return { ...actual, api: vi.fn(async () => ({ token: "token", url: "wss://livekit.test" })) };
});

vi.mock("@/lib/vozzera/idle-detection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vozzera/idle-detection")>();
  return {
    ...actual,
    startIdleDetection: vi.fn(actual.startIdleDetection),
    stopIdleDetection: vi.fn(actual.stopIdleDetection),
  };
});

type PendingPermission = { calls: number };

function installPendingIdleDetector(): PendingPermission {
  const counter = { calls: 0 };
  class FakeIdleDetector {
    static requestPermission() {
      counter.calls += 1;
      return new Promise<"granted">(() => undefined);
    }

    start() {
      return Promise.resolve();
    }

    addEventListener() {}

    removeEventListener() {}
  }
  (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector = FakeIdleDetector;
  return counter;
}

class FakeAudioContext {
  state = "running";

  async close() {
    this.state = "closed";
  }
}

async function joinRoom(roomId: string) {
  const calls: string[] = [];
  const sendVoiceLeave = (leave: VoiceLeave) => {
    calls.push(`voice.leave:${leave.roomId}:${leave.sid}`);
  };
  const hook = renderHook(() => useVoice({ sendVoiceLeave }));

  await act(async () => {
    await hook.result.current.connect(roomId);
  });

  const room = fakeLiveKit.FakeRoom.created();
  room.disconnect.mockImplementation(async () => {
    calls.push("room.disconnect");
  });

  return { ...hook, calls, room };
}

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fakeLiveKit.FakeRoom.instances.length = 0;
  delete (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector;
});

describe("useVoice idle detection lifecycle", () => {
  it("requests the permission once for two joins while the prompt is pending", async () => {
    const permission = installPendingIdleDetector();
    const { result } = renderHook(() => useVoice());

    await act(async () => {
      void result.current.connect("r1").catch(() => undefined);
      void result.current.connect("r1").catch(() => undefined);
    });

    expect(permission.calls).toBe(1);
  });

  it("stops the detector on disconnect", async () => {
    const { result } = renderHook(() => useVoice());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(vi.mocked(stopIdleDetection)).toHaveBeenCalled();
  });
});

describe("useVoice leave signalling", () => {
  it("joins the room without signalling a leave", async () => {
    const { result, calls } = await joinRoom("r1");

    expect(result.current.status).toBe("connected");
    expect(calls).toEqual([]);
  });

  it("builds the room with disconnect on page leave enabled", async () => {
    const { room } = await joinRoom("r1");

    expect(room.options.disconnectOnPageLeave).toBe(true);
  });

  it("sends voice.leave before disconnecting the room on hangup", async () => {
    const { result, calls } = await joinRoom("r1");

    await act(async () => {
      await result.current.disconnect();
    });

    expect(calls).toEqual(["voice.leave:r1:PA_local", "room.disconnect"]);
  });

  it("does not send voice.leave on hangup without a room", async () => {
    const sendVoiceLeave = vi.fn();
    const { result } = renderHook(() => useVoice({ sendVoiceLeave }));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(sendVoiceLeave).not.toHaveBeenCalled();
  });

  it("does not send voice.leave on hangup without a participant sid", async () => {
    const { result, calls, room } = await joinRoom("r1");
    room.localParticipant.sid = "";

    await act(async () => {
      await result.current.disconnect();
    });

    expect(calls).toEqual(["room.disconnect"]);
  });

  it("does not send voice.leave on pagehide without a participant sid", async () => {
    const { calls, room } = await joinRoom("r1");
    room.localParticipant.sid = "";

    window.dispatchEvent(new Event("pagehide"));

    expect(calls).toEqual(["room.disconnect"]);
  });

  it("does not send voice.leave when going away", async () => {
    const { result, calls } = await joinRoom("r1");

    await act(async () => {
      await result.current.goAway("idle");
    });

    expect(result.current.status).toBe("away");
    expect(calls).toEqual(["room.disconnect"]);
  });

  it("sends voice.leave before disconnecting the room on pagehide", async () => {
    const { calls } = await joinRoom("r1");

    window.dispatchEvent(new Event("pagehide"));

    expect(calls).toEqual(["voice.leave:r1:PA_local", "room.disconnect"]);
  });

  it("swallows a failed room disconnect on pagehide", async () => {
    const { room } = await joinRoom("r1");
    room.disconnect.mockRejectedValueOnce(new Error("already closed"));

    window.dispatchEvent(new Event("pagehide"));
    await act(async () => undefined);

    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the room connected when the tab goes to the background", async () => {
    const { calls } = await joinRoom("r1");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    document.dispatchEvent(new Event("visibilitychange"));

    expect(calls).toEqual([]);
  });

  it("removes the pagehide listener on unmount", () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useVoice());
    const pageHideListener = added.mock.calls.find(([type]) => type === "pagehide")?.[1];

    unmount();

    expect(pageHideListener).toBeTypeOf("function");
    expect(removed).toHaveBeenCalledWith("pagehide", pageHideListener);
  });

  it("does not signal a leave on pagehide after unmount", async () => {
    const { calls, unmount } = await joinRoom("r1");

    unmount();
    window.dispatchEvent(new Event("pagehide"));

    expect(calls).toEqual(["room.disconnect"]);
  });
});
