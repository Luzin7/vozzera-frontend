import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { pushToTalkLabelFor, type MicDevice } from "@/lib/vozzera/voice";

type Props = {
  micDevices: MicDevice[];
  selectedDeviceId: string | null;
  noiseFilter: boolean;
  krispSupported: boolean | null;
  selfMonitor: boolean;
  pushToTalkEnabled: boolean;
  pushToTalkKeyLabel: string;
  onSelectDevice: (deviceId: string) => void;
  onToggleNoiseFilter: (enabled: boolean) => void;
  onToggleSelfMonitor: (enabled: boolean) => void;
  onTogglePushToTalk: (enabled: boolean) => void;
  onPushToTalkKeyChange: (code: string, label: string) => void;
};

export function MicSettings({
  micDevices,
  selectedDeviceId,
  noiseFilter,
  krispSupported,
  selfMonitor,
  pushToTalkEnabled,
  pushToTalkKeyLabel,
  onSelectDevice,
  onToggleNoiseFilter,
  onToggleSelfMonitor,
  onTogglePushToTalk,
  onPushToTalkKeyChange,
}: Readonly<Props>) {
  const hasSelectedDevice = micDevices.some((device) => device.deviceId === selectedDeviceId);
  const [capturingPushToTalkKey, setCapturingPushToTalkKey] = useState(false);

  const capturePushToTalkKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturingPushToTalkKey || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    onPushToTalkKeyChange(event.code, pushToTalkLabelFor(event.key, event.code));
    setCapturingPushToTalkKey(false);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="mic-select">Microfone</Label>
        <Select
          value={hasSelectedDevice ? (selectedDeviceId ?? "") : ""}
          onValueChange={onSelectDevice}
        >
          <SelectTrigger id="mic-select" className="w-full">
            <SelectValue placeholder="Microfone padrão" />
          </SelectTrigger>
          <SelectContent>
            {micDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {micDevices.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum microfone encontrado. Entre num canal de voz para liberar a lista.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label htmlFor="noise-filter">Filtro de ruído (Krisp)</Label>
          {krispSupported === null && (
            <p className="mt-0.5 text-xs text-muted-foreground">Preparando o filtro de ruído…</p>
          )}
          {krispSupported === false && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Seu navegador não suporta o filtro de ruído.
            </p>
          )}
        </div>
        <Switch
          id="noise-filter"
          checked={noiseFilter}
          disabled={krispSupported !== true}
          onCheckedChange={onToggleNoiseFilter}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label htmlFor="self-monitor">Ouvir minha voz</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Use fones para evitar eco.</p>
        </div>
        <Switch id="self-monitor" checked={selfMonitor} onCheckedChange={onToggleSelfMonitor} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label htmlFor="push-to-talk">Push-to-talk</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Segure {pushToTalkKeyLabel} para falar. Ao soltar, o microfone volta a ficar mudo.
          </p>
        </div>
        <Switch
          id="push-to-talk"
          checked={pushToTalkEnabled}
          onCheckedChange={onTogglePushToTalk}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Tecla do push-to-talk</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {capturingPushToTalkKey ? "Pressione qualquer tecla." : "Clique para trocar o atalho."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-w-24"
          onClick={() => setCapturingPushToTalkKey(true)}
          onKeyDown={capturePushToTalkKey}
        >
          {capturingPushToTalkKey ? "Aguardando…" : pushToTalkKeyLabel}
        </Button>
      </div>
    </div>
  );
}
