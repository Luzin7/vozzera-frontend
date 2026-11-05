import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { MonitorPlay, MonitorX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { LiveShare } from "@/lib/vozzera/screen-share-watch";
import { useLiveShareLoadTimeout } from "@/lib/vozzera/use-live-share-load-timeout";

const LOADING_LABEL = "Carregando…";
const FAILED_LABEL = "Não consegui abrir a live";

function WatchShareButton({
  identity,
  pending,
  onWatch,
  onStopWatching,
  children,
}: Readonly<{
  identity: string;
  pending: boolean;
  onWatch: (identity: string) => void;
  onStopWatching: (identity: string) => void;
  children: ReactNode;
}>) {
  const handleTimeout = useCallback(() => onStopWatching(identity), [onStopWatching, identity]);
  const { failed, clearFailure } = useLiveShareLoadTimeout(pending, handleTimeout);

  useEffect(() => {
    if (failed) toast.error(FAILED_LABEL, { id: FAILED_LABEL });
  }, [failed]);

  const handleWatch = () => {
    clearFailure();
    onWatch(identity);
  };

  return (
    <>
      <Button
        size="sm"
        className="shrink-0"
        disabled={pending}
        aria-busy={pending}
        onClick={handleWatch}
      >
        <MonitorPlay className="h-3.5 w-3.5" />
        {pending ? LOADING_LABEL : children}
      </Button>
    </>
  );
}

export function LiveShareTileControls({
  identity,
  name,
  pending,
  onWatch,
  onStopWatching,
}: Readonly<{
  identity: string;
  name: string;
  pending: boolean;
  onWatch: (identity: string) => void;
  onStopWatching: (identity: string) => void;
}>) {
  return (
    <div className="absolute right-3 top-3 flex items-center gap-2">
      <span className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold uppercase text-destructive-foreground">
        Ao vivo
      </span>
      <WatchShareButton
        identity={identity}
        pending={pending}
        onWatch={onWatch}
        onStopWatching={onStopWatching}
      >
        Assistir
        <span className="sr-only"> {name}</span>
      </WatchShareButton>
    </div>
  );
}

export function LiveShareStageControls({
  featured,
  liveShares,
  watchingIdentities,
  arrivedIdentities,
  onWatch,
  onStopWatching,
}: Readonly<{
  featured: { identity: string; name: string } | undefined;
  liveShares: LiveShare[];
  watchingIdentities: ReadonlySet<string>;
  arrivedIdentities: ReadonlySet<string>;
  onWatch: (identity: string) => void;
  onStopWatching: (identity: string) => void;
}>) {
  const notYetWatching = liveShares.filter((share) => !arrivedIdentities.has(share.identity));

  return (
    <>
      {featured && (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => onStopWatching(featured.identity)}
        >
          <MonitorX className="h-3.5 w-3.5" />
          Parar de assistir
          <span className="sr-only"> {featured.name}</span>
        </Button>
      )}
      {notYetWatching.map((share) => (
        <WatchShareButton
          key={share.identity}
          identity={share.identity}
          pending={watchingIdentities.has(share.identity)}
          onWatch={onWatch}
          onStopWatching={onStopWatching}
        >
          Assistir {share.name}
        </WatchShareButton>
      ))}
    </>
  );
}
