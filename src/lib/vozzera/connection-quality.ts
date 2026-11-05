import { ConnectionQuality } from "livekit-client";

export type ConnectionQualityIndicator = {
  level: 0 | 1 | 2 | 3;
  label: string;
  shortLabel: string | null;
};

const INDICATORS: Partial<Record<ConnectionQuality, ConnectionQualityIndicator>> = {
  [ConnectionQuality.Excellent]: { level: 3, label: "Conexão excelente", shortLabel: null },
  [ConnectionQuality.Good]: { level: 2, label: "Conexão boa", shortLabel: null },
  [ConnectionQuality.Poor]: { level: 1, label: "Conexão ruim", shortLabel: "Ruim" },
  [ConnectionQuality.Lost]: { level: 0, label: "Conexão perdida", shortLabel: "Perdida" },
};

export function connectionQualityIndicatorFor(
  quality: ConnectionQuality | string | undefined,
): ConnectionQualityIndicator | null {
  if (quality === undefined) return null;
  return INDICATORS[quality as ConnectionQuality] ?? null;
}
