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
import type { ChangelogItem } from "@/lib/vozzera/changelog";

type Props = {
  open: boolean;
  items: ChangelogItem[];
  version: string;
  onDismiss: () => void;
};

export function WhatsNewDialog({ open, items, version, onDismiss }: Readonly<Props>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <DialogHeader>
          <DialogTitle>Tem coisa nova no Vozzera</DialogTitle>
          <DialogDescription>Confere o que chegou nesta versão ({version}).</DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.pr ?? item.title}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{item.title}</span>
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
