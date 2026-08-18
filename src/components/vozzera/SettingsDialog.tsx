import { LogOut, Mic2, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MicDevice } from "@/lib/vozzera/voice";
import { EmailChangeForm } from "./EmailChangeForm";
import { MicSettings } from "./MicSettings";

type Section = "microphone" | "account";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string | null;
  email: string | null;
  micDevices: MicDevice[];
  selectedDeviceId: string | null;
  noiseFilter: boolean;
  krispSupported: boolean;
  selfMonitor: boolean;
  onSelectDevice: (deviceId: string) => void;
  onToggleNoiseFilter: (enabled: boolean) => void;
  onToggleSelfMonitor: (enabled: boolean) => void;
  onUpdateEmail: (email: string) => Promise<string>;
  onLogout: () => void;
};

const sections: { id: Section; label: string; icon: typeof Mic2 }[] = [
  { id: "microphone", label: "Microfone e voz", icon: Mic2 },
  { id: "account", label: "Conta", icon: User },
];

export function SettingsDialog({
  open,
  onOpenChange,
  username,
  email,
  micDevices,
  selectedDeviceId,
  noiseFilter,
  krispSupported,
  selfMonitor,
  onSelectDevice,
  onToggleNoiseFilter,
  onToggleSelfMonitor,
  onUpdateEmail,
  onLogout,
}: Readonly<Props>) {
  const [section, setSection] = useState<Section>("microphone");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[520px] max-w-2xl gap-0 overflow-hidden p-0">
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-muted/30 p-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                section === id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
          {section === "microphone" ? (
            <>
              <DialogTitle className="mb-4 text-base">Microfone e voz</DialogTitle>
              <DialogDescription className="sr-only">
                Ajustes de microfone e áudio da sala de voz
              </DialogDescription>
              <MicSettings
                micDevices={micDevices}
                selectedDeviceId={selectedDeviceId}
                noiseFilter={noiseFilter}
                krispSupported={krispSupported}
                selfMonitor={selfMonitor}
                onSelectDevice={onSelectDevice}
                onToggleNoiseFilter={onToggleNoiseFilter}
                onToggleSelfMonitor={onToggleSelfMonitor}
              />
            </>
          ) : (
            <div className="flex min-h-full flex-1 flex-col">
              <DialogTitle className="mb-4 text-base">Conta</DialogTitle>
              <DialogDescription className="sr-only">Sessão e saída da conta</DialogDescription>
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">Entrando como</p>
                <p className="text-sm font-medium text-foreground">{username ?? "você"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{email ?? "sem email"}</p>
              </div>
              <EmailChangeForm onSubmit={onUpdateEmail} />
              <Button variant="destructive" className="mt-4 self-start" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
