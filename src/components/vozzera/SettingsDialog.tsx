import { Label } from "@/components/ui/label";
import { LogOut, Mic2, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
  soundEnabled: boolean;
  onSelectDevice: (deviceId: string) => void;
  onToggleNoiseFilter: (enabled: boolean) => void;
  onToggleSelfMonitor: (enabled: boolean) => void;
  onToggleSound: (enabled: boolean) => void;
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
  soundEnabled,
  onSelectDevice,
  onToggleNoiseFilter,
  onToggleSelfMonitor,
  onToggleSound,
  onUpdateEmail,
  onLogout,
}: Readonly<Props>) {
  const [section, setSection] = useState<Section>("microphone");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(520px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-lg p-0 sm:flex-row [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
        <nav className="flex w-full shrink-0 gap-0.5 overflow-x-auto border-b border-border bg-muted/30 p-2 pr-14 sm:w-44 sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r sm:pr-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
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
              <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-5">
                <div>
                  <Label htmlFor="sound-toggle">Som ao receber mensagem com a aba escondida</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Som curto e discreto quando chega mensagem com a aba minimizada.
                  </p>
                </div>
                <Switch id="sound-toggle" checked={soundEnabled} onCheckedChange={onToggleSound} />
              </div>
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
              <Button variant="destructive" className="mt-4 min-h-11 self-start" onClick={onLogout}>
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
