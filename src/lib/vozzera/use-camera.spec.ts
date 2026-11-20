import { describe, expect, it } from "vitest";

import { cameraOperationFor, nextCameraTarget } from "@/lib/vozzera/use-camera";

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
