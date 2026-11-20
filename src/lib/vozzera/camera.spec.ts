import { describe, expect, it } from "vitest";

import {
  CAMERA_PUBLISH_OPTIONS,
  cameraErrorFrom,
  canPublishCamera,
  isMirroredPreview,
  visibleCameraIdentities,
} from "@/lib/vozzera/camera";

function domException(name: string): DOMException {
  return new DOMException("camera", name);
}

function participants(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    identity: `remote-${index}`,
    isLocal: false,
    cameraOn: true,
  }));
}

describe("canPublishCamera", () => {
  it("requires getUserMedia", () => {
    expect(canPublishCamera({ getUserMedia: async () => new MediaStream() })).toBe(true);
    expect(canPublishCamera(undefined)).toBe(false);
  });
});

describe("cameraErrorFrom", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no-device"],
    ["DevicesNotFoundError", "no-device"],
    ["NotReadableError", "busy"],
    ["TrackStartError", "busy"],
  ] as const)("maps %s to %s", (name, kind) => {
    expect(cameraErrorFrom(domException(name))).toBe(kind);
  });

  it("treats unsupported calls as unknown support, never as denied", () => {
    expect(cameraErrorFrom(new TypeError("permissions.query is unavailable"))).toBe("unsupported");
  });

  it("falls back to publish failed", () => {
    expect(cameraErrorFrom(new Error("boom"))).toBe("publish-failed");
  });
});

describe("visibleCameraIdentities", () => {
  it("caps desktop and mobile subscriptions", () => {
    expect(visibleCameraIdentities(participants(20), 6)).toHaveLength(6);
    expect(visibleCameraIdentities(participants(20), 3)).toHaveLength(3);
  });

  it("never includes the local participant", () => {
    const all = [{ identity: "self", isLocal: true, cameraOn: true }, ...participants(20)];
    expect(visibleCameraIdentities(all, 6)).toEqual([
      "remote-0",
      "remote-1",
      "remote-2",
      "remote-3",
      "remote-4",
      "remote-5",
    ]);
  });

  it("never exceeds the cap", () => {
    expect(visibleCameraIdentities(participants(20), 6).length).toBeLessThanOrEqual(6);
    expect(visibleCameraIdentities(participants(20), 3).length).toBeLessThanOrEqual(3);
  });
});

describe("camera presentation", () => {
  it("mirrors only the local front camera", () => {
    expect(isMirroredPreview("local", "user")).toBe(true);
    expect(isMirroredPreview("local", "environment")).toBe(false);
    expect(isMirroredPreview("remote", "user")).toBe(false);
  });

  it("uses camera-specific publishing options", () => {
    expect(CAMERA_PUBLISH_OPTIONS).toMatchObject({
      videoCodec: "vp8",
      simulcast: true,
      videoEncoding: { maxBitrate: 800_000, maxFramerate: 30 },
    });
    expect(CAMERA_PUBLISH_OPTIONS.videoSimulcastLayers).toHaveLength(2);
  });
});
