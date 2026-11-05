import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatReleaseDate } from "@/lib/vozzera/changelog";
import type { ChangelogRelease } from "@/lib/vozzera/changelog";

const SINGLE_RELEASE_DESCRIPTION = "Confere o que chegou na versão";
const MANY_RELEASES_DESCRIPTION = "Confere tudo que chegou desde a sua última visita";

type Props = {
  open: boolean;
  releases: ChangelogRelease[];
  onDismiss: () => void;
};

function releaseHeading(release: ChangelogRelease): string {
  const date = formatReleaseDate(release.releasedAt);

  return date === null ? release.version : `${release.version} · ${date}`;
}

function describeReleases(releases: ChangelogRelease[]): string {
  const [only] = releases;

  if (releases.length !== 1 || only === undefined) return MANY_RELEASES_DESCRIPTION;

  return `${SINGLE_RELEASE_DESCRIPTION} ${releaseHeading(only)}`;
}

export function WhatsNewDialog({ open, releases, onDismiss }: Readonly<Props>) {
  return (
    <Dialog
      open={open && releases.length > 0}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col rounded-lg motion-reduce:duration-0 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <DialogHeader>
          <DialogTitle>Tem coisa nova no Vozzera</DialogTitle>
          <DialogDescription>{describeReleases(releases)}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
          {releases.map((release) => (
            <section key={release.version} className="space-y-3">
              {releases.length > 1 && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {releaseHeading(release)}
                </h3>
              )}
              <ul className="space-y-3">
                {release.items.map((item) => (
                  <li
                    key={item.pr ?? item.title}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={onDismiss}>Que massa!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
