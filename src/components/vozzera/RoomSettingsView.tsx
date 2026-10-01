import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MAX_ROOM_NAME_LENGTH, type Room } from "@/lib/vozzera/types";

type Props = {
  room: Room;
  onClose: () => void;
  onSave: (roomId: string, input: { name: string; staffOnly: boolean }) => Promise<void>;
  onDelete: (roomId: string) => Promise<void>;
};

export function RoomSettingsView({ room, onClose, onSave, onDelete }: Readonly<Props>) {
  const [name, setName] = useState(room.name);
  const [staffOnly, setStaffOnly] = useState(room.staff_only);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = async () => {
    const clean = name.trim();

    if (!clean) {
      setError("Dê um nome para a sala.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onSave(room.id, { name: clean, staffOnly });
      onClose();
    } catch {
      setError("Não foi possível salvar a sala.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);

    try {
      await onDelete(room.id);
      onClose();
    } catch {
      setError("Não foi possível apagar a sala.");
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
        <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">Configurações da sala</h2>
          <p className="truncate text-xs text-muted-foreground">{room.name}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Geral</h3>

          <div className="space-y-2">
            <Label htmlFor="room-settings-name">Nome do canal</Label>
            <Input
              id="room-settings-name"
              value={name}
              maxLength={MAX_ROOM_NAME_LENGTH}
              placeholder="geral"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-input p-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="room-settings-staff-only">Só para moderação</Label>
              <p className="text-xs text-muted-foreground">
                A sala fica visível e acessível apenas para mod e admin.
              </p>
            </div>
            <Switch
              id="room-settings-staff-only"
              checked={staffOnly}
              onCheckedChange={setStaffOnly}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-destructive">Zona de perigo</h3>
            <p className="text-xs text-muted-foreground">
              Apagar a sala remove todo o histórico dela permanentemente.
            </p>
          </div>
          <Button variant="destructive" disabled={busy} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Apagar sala
          </Button>
        </section>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar sala?</AlertDialogTitle>
            <AlertDialogDescription>
              A sala {room.name} e todo o histórico dela serão apagados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void remove()}
            >
              Apagar sala
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
