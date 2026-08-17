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
import { MAX_ROOM_NAME_LENGTH, type Room } from "@/lib/vozzera/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRooms: Room[];
  room?: Room | null;
  onCreate: (name: string, type: "text" | "voice") => Promise<void>;
  onUpdate: (roomId: string, name: string) => Promise<void>;
};

export function CreateRoomDialog({
  open,
  onOpenChange,
  existingRooms,
  room,
  onCreate,
  onUpdate,
}: Readonly<Props>) {
  const [name, setName] = useState(room?.name ?? "");
  const [type, setType] = useState<"text" | "voice">(room?.type ?? "text");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName(room?.name ?? "");
    setType(room?.type ?? "text");
    setError(null);
    onOpenChange(false);
  };

  const submit = async () => {
    const clean = name.trim();

    if (!clean) {
      setError("Dê um nome para a sala.");
      return;
    }

    const duplicate = existingRooms.some(
      (current) => current.id !== room?.id && current.name.toLowerCase() === clean.toLowerCase(),
    );

    if (duplicate) {
      setError("Já existe uma sala com esse nome.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (room) await onUpdate(room.id, clean);
      if (!room) await onCreate(clean, type);
      close();
    } catch {
      setError("Não foi possível salvar a sala.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Editar sala" : "Nova sala"}</DialogTitle>
          <DialogDescription>
            {room
              ? "Altere o nome exibido para todos os membros."
              : "Escolha um nome e o tipo da nova sala."}
          </DialogDescription>
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

          {!room && (
            <div className="space-y-2">
              <Label htmlFor="room-type">Tipo</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value === "voice" ? "voice" : "text")}
              >
                <SelectTrigger id="room-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="voice">Voz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Salvando..." : room ? "Salvar alterações" : "Criar sala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
