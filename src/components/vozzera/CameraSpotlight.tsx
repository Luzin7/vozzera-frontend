import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { CameraTileVideo } from "@/components/vozzera/CameraTileVideo";
import { avatarColorClass, initials } from "@/lib/vozzera/avatar";
import { useCameraState } from "@/lib/vozzera/camera-store";

type SpotlightParticipant = { identity: string; name: string };

type Props = {
  participant: SpotlightParticipant;
  participants: SpotlightParticipant[];
  opener: HTMLButtonElement | null;
  onSelect: (participant: SpotlightParticipant) => void;
  onClose: () => void;
};

function SpotlightVideo({ participant }: Readonly<{ participant: SpotlightParticipant }>) {
  const camera = useCameraState(participant.identity);
  if (!camera.on || !camera.track) {
    return (
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full font-mono text-2xl font-semibold ${avatarColorClass(participant.name)}`}
      >
        {initials(participant.name)}
      </div>
    );
  }
  return (
    <CameraTileVideo
      identity={participant.identity}
      name={participant.name}
      camera={camera}
      className="relative aspect-video max-h-[calc(100dvh-8rem)] w-full cursor-default"
    />
  );
}

export function CameraSpotlight({
  participant,
  participants,
  opener,
  onSelect,
  onClose,
}: Readonly<Props>) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [onClose, opener]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vídeo de ${participant.name}`}
      className="fixed inset-0 z-40 flex flex-col bg-background/95 p-3 pb-20"
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
        <SpotlightVideo participant={participant} />
        <span className="absolute bottom-3 left-3 z-20 rounded-md bg-background/80 px-2 py-1 text-sm text-foreground">
          {participant.name}
        </span>
        <Button
          ref={closeRef}
          variant="secondary"
          className="absolute right-3 top-3 z-20"
          onClick={onClose}
        >
          Voltar para a grade
        </Button>
      </div>
      <div className="mt-2 flex h-24 shrink-0 gap-2 overflow-x-auto">
        {participants
          .filter((item) => item.identity !== participant.identity)
          .map((item) => (
            <button
              key={item.identity}
              type="button"
              className="flex aspect-video h-24 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(item)}
            >
              {item.name}
            </button>
          ))}
      </div>
    </div>
  );
}
