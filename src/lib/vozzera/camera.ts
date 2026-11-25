import { VideoPresets } from "livekit-client";
import type { TrackPublishOptions } from "livekit-client";

import type { CameraErrorKind } from "@/lib/vozzera/camera-errors";

export const DESKTOP_CAMERA_CAP = 6;
export const MOBILE_CAMERA_CAP = 3;

export const CAMERA_PUBLISH_OPTIONS: TrackPublishOptions = {
  videoCodec: "vp8",
  simulcast: true,
  videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
  videoEncoding: { maxBitrate: 800_000, maxFramerate: 30 },
};

export type CameraParticipant = {
  identity: string;
  isLocal: boolean;
  cameraOn: boolean;
};

export type CameraFacingMode = "user" | "environment";

export type CameraDevice = {
  deviceId: string;
  label: string;
};

export function videoInputDevices(
  devices: readonly Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">[],
): CameraDevice[] {
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Câmera ${index + 1}`,
    }));
}

export function nextCameraDeviceId(
  devices: readonly CameraDevice[],
  activeDeviceId: string | null,
): string | null {
  if (devices.length < 2) return null;
  const activeIndex = devices.findIndex((device) => device.deviceId === activeDeviceId);
  return devices[(activeIndex + 1) % devices.length]?.deviceId ?? null;
}

export async function switchCameraDevice(
  room: { switchActiveDevice: (kind: MediaDeviceKind, deviceId: string) => Promise<boolean> },
  deviceId: string,
): Promise<void> {
  const switched = await room.switchActiveDevice("videoinput", deviceId);
  if (!switched) throw new Error("camera switch failed");
}

export function canPublishCamera(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | undefined,
): boolean {
  return typeof mediaDevices?.getUserMedia === "function";
}

export function cameraErrorFrom(error: unknown): CameraErrorKind {
  if (error instanceof TypeError) return "unsupported";
  if (!(error instanceof DOMException)) return "publish-failed";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "no-device";
  if (error.name === "NotReadableError" || error.name === "TrackStartError") return "busy";
  return "publish-failed";
}

export function visibleCameraIdentities(
  participants: readonly CameraParticipant[],
  cap: number,
): string[] {
  if (cap <= 0) return [];
  return participants
    .filter((participant) => participant.cameraOn && !participant.isLocal)
    .slice(0, cap)
    .map((participant) => participant.identity);
}

export function isMirroredPreview(
  source: "local" | "remote",
  facingMode: CameraFacingMode,
): boolean {
  return source === "local" && facingMode === "user";
}
