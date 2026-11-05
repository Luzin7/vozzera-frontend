import { ConnectionQuality } from "livekit-client";

export type ConnectionQualityIndicator = {
  level: 0 | 1 | 2 | 3;
  label: string;
};

const INDICATORS: Partial<Record<ConnectionQuality, ConnectionQualityIndicator>> = {
  [ConnectionQuality.Excellent]: { level: 3, label: "Conexão excelente" },
  [ConnectionQuality.Good]: { level: 2, label: "Conexão boa" },
  [ConnectionQuality.Poor]: { level: 1, label: "Conexão ruim" },
  [ConnectionQuality.Lost]: { level: 0, label: "Conexão perdida" },
};

export function connectionQualityIndicatorFor(
  quality: ConnectionQuality | string | undefined,
): ConnectionQualityIndicator | null {
  if (quality === undefined) return null;
  return INDICATORS[quality as ConnectionQuality] ?? null;
}
