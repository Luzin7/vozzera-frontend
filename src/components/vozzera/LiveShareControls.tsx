import { MonitorPlay, MonitorX } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LiveShare, WatchIntents } from "@/lib/vozzera/screen-share-watch";

export function LiveShareTileControls({
  share,
  watchingIdentities,
  onWatch,
}: Readonly<{
  share: LiveShare;
  watchingIdentities: WatchIntents;
  onWatch: (identity: string) => void;
}>) {
  const isLoading = watchingIdentities.has(share.identity);

  return (
    <div className="absolute right-3 top-3 flex items-center gap-2">
      <span className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold uppercase text-destructive-foreground">
        Ao vivo
      </span>
      <Button size="sm" disabled={isLoading} onClick={() => onWatch(share.identity)}>
        <MonitorPlay className="h-3.5 w-3.5" />
        {isLoading ? "Carregando…" : "Assistir"}
        <span className="sr-only"> {share.name}</span>
      </Button>
    </div>
  );
}

export function LiveShareStageControls({
  featured,
  liveShares,
  watchingIdentities,
  onWatch,
  onStopWatching,
}: Readonly<{
  featured: { identity: string; name: string } | undefined;
  liveShares: LiveShare[];
  watchingIdentities: WatchIntents;
  onWatch: (identity: string) => void;
  onStopWatching: (identity: string) => void;
}>) {
  const unwatched = liveShares.filter((share) => !watchingIdentities.has(share.identity));
  if (!featured && unwatched.length === 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-muted/30 px-3 py-2">
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
      {unwatched.map((share) => (
        <Button
          key={share.identity}
          size="sm"
          className="shrink-0"
          onClick={() => onWatch(share.identity)}
        >
          <MonitorPlay className="h-3.5 w-3.5" />
          Assistir {share.name}
        </Button>
      ))}
    </div>
  );
}
