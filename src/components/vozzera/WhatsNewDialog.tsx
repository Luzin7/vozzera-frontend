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
import { formatReleaseDate, visibleItems } from "@/lib/vozzera/changelog";
import type { ChangelogItem } from "@/lib/vozzera/changelog";

type Props = {
  open: boolean;
  items: ChangelogItem[];
  version: string;
  releasedAt?: string | undefined;
  onDismiss: () => void;
};

export function WhatsNewDialog({ open, items, version, releasedAt, onDismiss }: Readonly<Props>) {
  const highlights = visibleItems(items);
  const date = formatReleaseDate(releasedAt);

  return (
    <Dialog
      open={open && highlights.length > 0}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <DialogHeader>
          <DialogTitle>Tem coisa nova no Vozzera</DialogTitle>
          <DialogDescription>
            Confere o que chegou na versão {version}
            {date === null ? "" : ` · ${date}`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {highlights.map((item) => (
            <li
              key={item.pr ?? item.title}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item.summary}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button onClick={onDismiss}>Que massa!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
