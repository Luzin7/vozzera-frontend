import { useSyncExternalStore } from "react";

import type { CameraFacingMode } from "@/lib/vozzera/camera";

type Listener = () => void;

export type CameraTrack = {
  attach: (element: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

export type CameraState = {
  on: boolean;
  muted: boolean;
  isLocal: boolean;
  facingMode: CameraFacingMode;
  track: CameraTrack | null;
};

const OFF_CAMERA_STATE: CameraState = {
  on: false,
  muted: false,
  isLocal: false,
  facingMode: "user",
  track: null,
};

const cameraStates = new Map<string, CameraState>();
const cameraListeners = new Map<string, Set<Listener>>();
const localPublishingListeners = new Set<Listener>();
let localCameraPublishing = false;

function listenersFor(identity: string): Set<Listener> {
  const existing = cameraListeners.get(identity);
  if (existing) return existing;
  const listeners = new Set<Listener>();
  cameraListeners.set(identity, listeners);
  return listeners;
}

function emit(listeners: ReadonlySet<Listener> | undefined): void {
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function sameCameraState(a: CameraState, b: CameraState): boolean {
  return (
    a.on === b.on &&
    a.muted === b.muted &&
    a.isLocal === b.isLocal &&
    a.facingMode === b.facingMode &&
    a.track === b.track
  );
}

export function cameraStateFor(identity: string): CameraState {
  return cameraStates.get(identity) ?? OFF_CAMERA_STATE;
}

export function subscribeCameraState(identity: string, listener: Listener): () => void {
  const listeners = listenersFor(identity);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) cameraListeners.delete(identity);
  };
}

export function setCameraState(identity: string, patch: Partial<CameraState>): void {
  const previous = cameraStateFor(identity);
  const next = { ...previous, ...patch };
  if (sameCameraState(previous, next)) return;
  cameraStates.set(identity, next);
  emit(cameraListeners.get(identity));
}

export function clearCameraState(identity: string): void {
  if (!cameraStates.delete(identity)) return;
  emit(cameraListeners.get(identity));
}

export function setLocalCameraPublishing(publishing: boolean): void {
  if (localCameraPublishing === publishing) return;
  localCameraPublishing = publishing;
  emit(localPublishingListeners);
}

export function localCameraPublishingSnapshot(): boolean {
  return localCameraPublishing;
}

export function subscribeLocalCameraPublishing(listener: Listener): () => void {
  localPublishingListeners.add(listener);
  return () => localPublishingListeners.delete(listener);
}

export function resetCameraStore(): void {
  const identities = [...cameraStates.keys()];
  cameraStates.clear();
  for (const identity of identities) emit(cameraListeners.get(identity));
  setLocalCameraPublishing(false);
}

export function useCameraState(identity: string): CameraState {
  return useSyncExternalStore(
    (listener) => subscribeCameraState(identity, listener),
    () => cameraStateFor(identity),
    () => OFF_CAMERA_STATE,
  );
}

export function useLocalCameraPublishing(): boolean {
  return useSyncExternalStore(
    subscribeLocalCameraPublishing,
    localCameraPublishingSnapshot,
    () => false,
  );
}
