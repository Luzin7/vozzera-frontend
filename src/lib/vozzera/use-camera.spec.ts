import { describe, expect, it } from "vitest";

import { cameraOperationFor, cameraPageAction, nextCameraTarget } from "@/lib/vozzera/use-camera";

describe("camera state machine", () => {
  it("enables only while the target is on and no track exists", () => {
    expect(cameraOperationFor(true, false)).toBe("enable");
    expect(cameraOperationFor(true, true)).toBeNull();
  });

  it("disables only while the target is off and a track exists", () => {
    expect(cameraOperationFor(false, true)).toBe("disable");
    expect(cameraOperationFor(false, false)).toBeNull();
  });

  it("turns a rapid second tap into an off target", () => {
    const firstTap = nextCameraTarget(false);
    const secondTap = nextCameraTarget(firstTap);

    expect(firstTap).toBe(true);
    expect(secondTap).toBe(false);
  });
});

describe("camera page lifecycle", () => {
  it("keeps publishing while another tab is active", () => {
    expect(cameraPageAction(true, false)).toBe("keep");
  });

  it("resumes a browser-muted track after returning to the tab", () => {
    expect(cameraPageAction(false, false)).toBe("resume");
  });

  it("disables the camera only when the page is exiting", () => {
    expect(cameraPageAction(true, true)).toBe("disable");
    expect(cameraPageAction(false, true)).toBe("disable");
  });
});
