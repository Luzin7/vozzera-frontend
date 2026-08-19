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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScreenShareQuality } from "@/lib/vozzera/useVoice";

type Resolution = "720p" | "1080p";
type FrameRate = "30" | "60";

const resolutionSize: Record<Resolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

export function ScreenShareDialog({
  open,
  onOpenChange,
  onStart,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (quality: ScreenShareQuality) => void;
}>) {
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [frameRate, setFrameRate] = useState<FrameRate>("30");

  const start = () => {
    const size = resolutionSize[resolution];

    onStart({ ...size, frameRate: Number(frameRate) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <DialogHeader>
          <DialogTitle>Compartilhar tela</DialogTitle>
          <DialogDescription>Escolha a qualidade da transmissão.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-resolution">Resolução</Label>
            <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
              <SelectTrigger id="share-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p (Full HD)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-fps">Quadros por segundo</Label>
            <Select value={frameRate} onValueChange={(v) => setFrameRate(v as FrameRate)}>
              <SelectTrigger id="share-fps">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
