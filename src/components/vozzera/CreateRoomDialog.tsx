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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MAX_ROOM_NAME_LENGTH, type Room } from "@/lib/vozzera/types";

type RoomDialogInput = {
  name: string;
  hasVoice: boolean;
  staffOnly: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRooms: Room[];
  onCreate: (input: RoomDialogInput) => Promise<void>;
};

export function CreateRoomDialog({ open, onOpenChange, existingRooms, onCreate }: Readonly<Props>) {
  const [name, setName] = useState("");
  const [hasVoice, setHasVoice] = useState(false);
  const [staffOnly, setStaffOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName("");
    setHasVoice(false);
    setStaffOnly(false);
    setError(null);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    close();
  };

  const submit = async () => {
    const clean = name.trim();

    if (!clean) {
      setError("Dê um nome para a sala.");
      return;
    }

    const duplicate = existingRooms.some(
      (current) => current.name.toLowerCase() === clean.toLowerCase(),
    );

    if (duplicate) {
      setError("Já existe uma sala com esse nome.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onCreate({ name: clean, hasVoice, staffOnly });
      close();
    } catch {
      setError("Não foi possível salvar a sala.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <DialogHeader>
          <DialogTitle>Nova sala</DialogTitle>
          <DialogDescription>Canais de voz também ganham um chat próprio.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Nome</Label>
            <Input
              id="room-name"
              value={name}
              maxLength={MAX_ROOM_NAME_LENGTH}
              placeholder="geral"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-kind">Capacidade</Label>
            <Select
              value={hasVoice ? "voice" : "text"}
              onValueChange={(value) => setHasVoice(value === "voice")}
            >
              <SelectTrigger id="room-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Somente texto</SelectItem>
                <SelectItem value="voice">Texto e voz</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A capacidade de voz não pode ser alterada depois de criada.
            </p>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-input p-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="room-staff-only">Só para moderação</Label>
              <p className="text-xs text-muted-foreground">
                A sala fica visível e acessível apenas para mod e admin.
              </p>
            </div>
            <Switch id="room-staff-only" checked={staffOnly} onCheckedChange={setStaffOnly} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Salvando..." : "Criar sala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
