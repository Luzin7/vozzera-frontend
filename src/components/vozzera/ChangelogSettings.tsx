import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatReleaseDate, releasesOf, visibleItems } from "@/lib/vozzera/changelog";
import type { Changelog, ChangelogRelease } from "@/lib/vozzera/changelog";
import { useChangelogQuery } from "@/lib/vozzera/useChangelog";

const SKELETON_ROWS = 3;

function publishedReleases(changelog: Changelog): ChangelogRelease[] {
  return releasesOf(changelog)
    .map((release) => ({ ...release, items: visibleItems(release.items) }))
    .filter((release) => release.items.length > 0);
}

function ReleaseSection({ release }: Readonly<{ release: ChangelogRelease }>) {
  const date = formatReleaseDate(release.releasedAt);

  return (
    <section aria-labelledby={`release-${release.version}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 id={`release-${release.version}`} className="text-sm font-semibold text-foreground">
          {release.version}
        </h3>
        {date !== null && release.releasedAt !== undefined && (
          <time dateTime={release.releasedAt} className="text-xs text-muted-foreground">
            {date}
          </time>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {release.items.map((item) => (
          <li
            key={item.pr ?? item.summary}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{item.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChangelogSettings() {
  const { data, isPending, isError, refetch, isFetching } = useChangelogQuery(true);

  if (isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <span className="sr-only">Carregando novidades…</span>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-muted-foreground">Não consegui carregar as novidades.</p>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const releases = publishedReleases(data);

  if (releases.length === 0) {
    return <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>;
  }

  return (
    <div className="space-y-6">
      {releases.map((release) => (
        <ReleaseSection key={release.version} release={release} />
      ))}
    </div>
  );
}
