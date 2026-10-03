import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ScreenShareIntent } from "@/lib/vozzera/voice";

type IntentOption = {
  value: ScreenShareIntent;
  label: string;
  hint: string;
  description: string;
};

const INTENT_OPTIONS: IntentOption[] = [
  {
    value: "text",
    label: "Texto e código",
    hint: "1080p, 15 fps",
    description: "Documentos, código e slides.",
  },
  {
    value: "video",
    label: "Vídeo e jogos",
    hint: "1080p, 60 fps",
    description: "Melhor equilíbrio para assistir.",
  },
  {
    value: "economy",
    label: "Economia",
    hint: "720p, 30 fps",
    description: "Para internet fraca.",
  },
];

export function ScreenShareDialog({
  open,
  onOpenChange,
  onStart,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (intent: ScreenShareIntent) => void;
}>) {
  const [intent, setIntent] = useState<ScreenShareIntent>("text");

  const start = () => {
    onStart(intent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <DialogHeader>
          <DialogTitle>Compartilhar tela</DialogTitle>
          <DialogDescription>Escolha o que você vai mostrar.</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={intent}
          onValueChange={(value) => setIntent(value as ScreenShareIntent)}
          className="gap-2"
        >
          {INTENT_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`share-intent-${option.value}`}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                intent === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
            >
              <RadioGroupItem
                id={`share-intent-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        <p className="text-xs text-muted-foreground">
          Dica: prefira uma janela e confirme “compartilhar áudio” no seletor.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={start}>Começar a compartilhar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
