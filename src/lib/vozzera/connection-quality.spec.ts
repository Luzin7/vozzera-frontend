import { ConnectionQuality } from "livekit-client";
import { describe, expect, it } from "vitest";

import { connectionQualityIndicatorFor } from "./connection-quality";

describe("connectionQualityIndicatorFor", () => {
  it.each([
    [ConnectionQuality.Excellent, { level: 3, label: "Conexão excelente", shortLabel: null }],
    [ConnectionQuality.Good, { level: 2, label: "Conexão boa", shortLabel: null }],
    [ConnectionQuality.Poor, { level: 1, label: "Conexão ruim", shortLabel: "Ruim" }],
    [ConnectionQuality.Lost, { level: 0, label: "Conexão perdida", shortLabel: "Perdida" }],
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
