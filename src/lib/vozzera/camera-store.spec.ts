import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cameraStateFor,
  clearCameraState,
  localCameraPublishingSnapshot,
  resetCameraStore,
  setCameraState,
  setLocalCameraPublishing,
  subscribeCameraState,
  subscribeLocalCameraPublishing,
} from "@/lib/vozzera/camera-store";

describe("camera store", () => {
  beforeEach(resetCameraStore);

  it("emits only for the changed identity", () => {
    const ana = vi.fn();
    const bia = vi.fn();
    const unsubscribeAna = subscribeCameraState("ana", ana);
    const unsubscribeBia = subscribeCameraState("bia", bia);

    setCameraState("ana", { on: true });

    expect(ana).toHaveBeenCalledOnce();
    expect(bia).not.toHaveBeenCalled();
    unsubscribeAna();
    unsubscribeBia();
  });

  it("keeps stable snapshots while state is unchanged", () => {
    setCameraState("ana", { on: true, isLocal: true });
    const snapshot = cameraStateFor("ana");

    setCameraState("ana", { on: true });

    expect(cameraStateFor("ana")).toBe(snapshot);
  });

  it("returns the shared off snapshot after clearing", () => {
    setCameraState("ana", { on: true });
    clearCameraState("ana");

    expect(cameraStateFor("ana")).toBe(cameraStateFor("unknown"));
  });

  it("tracks local publishing independently", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalCameraPublishing(listener);

    setLocalCameraPublishing(true);
    setLocalCameraPublishing(true);

    expect(localCameraPublishingSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
