import { ConnectionQuality } from "livekit-client";
import { describe, expect, it } from "vitest";

import { connectionQualityIndicatorFor } from "./connection-quality";

describe("connectionQualityIndicatorFor", () => {
  it.each([
    [ConnectionQuality.Excellent, { level: 3, label: "Conexão excelente" }],
    [ConnectionQuality.Good, { level: 2, label: "Conexão boa" }],
    [ConnectionQuality.Poor, { level: 1, label: "Conexão ruim" }],
    [ConnectionQuality.Lost, { level: 0, label: "Conexão perdida" }],
  ])("maps %s", (quality, expected) => {
    expect(connectionQualityIndicatorFor(quality)).toEqual(expected);
  });

  it("returns null for unknown", () => {
    expect(connectionQualityIndicatorFor(ConnectionQuality.Unknown)).toBeNull();
  });

  it("returns null when missing", () => {
    expect(connectionQualityIndicatorFor(undefined)).toBeNull();
  });
});
