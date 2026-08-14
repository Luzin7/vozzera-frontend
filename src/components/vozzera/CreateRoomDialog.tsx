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
import type { Room } from "@/lib/vozzera/types";

export function CreateRoomDialog({
  open,
  onOpenChange,
  existingRooms,
  onCreate,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRooms: Room[];
  onCreate: (name: string, type: "text" | "voice") => Promise<void>;
}>) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError("Dê um nome pra sala.");
      return;
    }
    if (existingRooms.some((r) => r.name.toLowerCase() === clean.toLowerCase())) {
      setError("Já existe uma sala com esse nome.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onCreate(clean, type);
      setName("");
      setType("text");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a sala.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova sala</DialogTitle>
          <DialogDescription>
            Salas de voz podem ser criadas agora, mas só funcionarão quando a voz entrar no ar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Nome</Label>
            <Input
              id="room-name"
              value={name}
              placeholder="geral"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-type">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v === "voice" ? "voice" : "text")}>
              <SelectTrigger id="room-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="voice">Voz</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Criando..." : "Criar sala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
