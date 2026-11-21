import { Camera, SwitchCamera, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CameraTileVideo } from "@/components/vozzera/CameraTileVideo";
import { avatarColorClass, initials } from "@/lib/vozzera/avatar";
import { nextCameraDeviceId, type CameraDevice } from "@/lib/vozzera/camera";
import { CAMERA_SWITCH_TEXT } from "@/lib/vozzera/camera-errors";
import { useCameraState } from "@/lib/vozzera/camera-store";

type StageParticipant = {
  identity: string;
  name: string;
  isLocal: boolean;
  cameraOn: boolean;
};

function StageSurface({ participant }: Readonly<{ participant: StageParticipant }>) {
  const camera = useCameraState(participant.identity);
  if (camera.on && camera.track) {
    return (
      <CameraTileVideo
        identity={participant.identity}
        name={participant.name}
        camera={camera}
        className="relative h-full w-full cursor-default"
      />
    );
  }
  return (
    <div
      className={`flex h-20 w-20 items-center justify-center rounded-full font-mono text-xl font-semibold ${avatarColorClass(participant.name)}`}
    >
      {initials(participant.name)}
    </div>
  );
}

function RailParticipant({
  participant,
  selected,
  onSelect,
}: Readonly<{
  participant: StageParticipant;
  selected: boolean;
  onSelect: () => void;
}>) {
  const camera = useCameraState(participant.identity);
  return (
    <button
      type="button"
      className={`relative flex h-20 aspect-video shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-card ${selected ? "border-primary" : "border-border"}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      {camera.on && camera.track ? (
        <CameraTileVideo
          identity={participant.identity}
          name={participant.name}
          camera={camera}
          className="relative h-full w-full cursor-pointer"
        />
      ) : (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full font-mono text-xs font-semibold ${avatarColorClass(participant.name)}`}
        >
          {initials(participant.name)}
        </span>
      )}
      <span className="absolute bottom-1 left-1 z-20 max-w-[calc(100%-0.5rem)] truncate rounded bg-background/80 px-1 text-xs">
        {participant.name}
      </span>
      {participant.cameraOn && (
        <Video
          aria-label={
            participant.isLocal
              ? "Sua câmera está ligada"
              : `${participant.name} está com a câmera ligada`
          }
          className="absolute right-1 top-1 z-20 h-4 w-4 rounded bg-background/80 p-0.5 text-primary"
        />
      )}
    </button>
  );
}

export function CameraStage({
  participants,
  cameraOn,
  cameraDevices,
  activeCameraDeviceId,
  onSwitchCamera,
}: Readonly<{
  participants: StageParticipant[];
  cameraOn: boolean;
  cameraDevices: CameraDevice[];
  activeCameraDeviceId: string | null;
  onSwitchCamera: (deviceId: string) => void;
}>) {
  const initialIdentity = useMemo(
    () =>
      participants.find((participant) => participant.isLocal && participant.cameraOn)?.identity ??
      participants.find((participant) => participant.cameraOn)?.identity ??
      participants.find((participant) => participant.isLocal)?.identity ??
      participants[0]?.identity ??
      null,
    [participants],
  );
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(initialIdentity);
  const previousSelectionRef = useRef({ identity: selectedIdentity, cameraOn: false });
  const selected =
    participants.find((participant) => participant.identity === selectedIdentity) ??
    participants[0];
  const nextDeviceId = nextCameraDeviceId(cameraDevices, activeCameraDeviceId);

  useEffect(() => {
    const previous = previousSelectionRef.current;
    const selectedStillExists = participants.some((item) => item.identity === selectedIdentity);
    const selectedTurnedOff =
      previous.identity === selectedIdentity && previous.cameraOn && selected?.cameraOn === false;
    const localAvatarHasRemoteVideo =
      selected?.isLocal === true &&
      selected.cameraOn === false &&
      participants.some((participant) => !participant.isLocal && participant.cameraOn);

    previousSelectionRef.current = {
      identity: selectedIdentity,
      cameraOn: selected?.cameraOn ?? false,
    };
    if (selectedStillExists && !selectedTurnedOff && !localAvatarHasRemoteVideo) return;
    setSelectedIdentity(initialIdentity);
  }, [initialIdentity, participants, selected, selectedIdentity]);

  if (!selected) return null;

  return (
    <div className="flex min-h-0 shrink-0 flex-col md:hidden">
      <div className="relative mx-3 mt-3 flex aspect-[4/3] max-h-[38dvh] items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
        <StageSurface participant={selected} />
        <span className="absolute bottom-2 left-2 z-20 flex items-center gap-1 rounded bg-background/80 px-2 py-1 text-xs">
          {selected.name}
          {selected.cameraOn && (
            <Video
              aria-label={
                selected.isLocal
                  ? "Sua câmera está ligada"
                  : `${selected.name} está com a câmera ligada`
              }
              className="h-3.5 w-3.5 text-primary"
            />
          )}
        </span>
        {cameraOn && selected.isLocal && nextDeviceId && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 z-20 h-11 w-11"
            onClick={() => onSwitchCamera(nextDeviceId)}
            title={CAMERA_SWITCH_TEXT}
          >
            <SwitchCamera className="h-4 w-4" />
            <span className="sr-only">{CAMERA_SWITCH_TEXT}</span>
          </Button>
        )}
        {!cameraOn && selected.isLocal && (
          <Camera className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex h-24 shrink-0 gap-2 overflow-x-auto px-3 py-2">
        {participants
          .filter((participant) => participant.identity !== selected.identity)
          .map((participant) => (
            <RailParticipant
              key={participant.identity}
              participant={participant}
              selected={participant.identity === selected.identity}
              onSelect={() => setSelectedIdentity(participant.identity)}
            />
          ))}
      </div>
    </div>
  );
}
