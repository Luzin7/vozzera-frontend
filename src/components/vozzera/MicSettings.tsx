import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { MicDevice } from "@/lib/vozzera/voice";

type Props = {
  micDevices: MicDevice[];
  selectedDeviceId: string | null;
  noiseFilter: boolean;
  selfMonitor: boolean;
  onSelectDevice: (deviceId: string) => void;
  onToggleNoiseFilter: (enabled: boolean) => void;
  onToggleSelfMonitor: (enabled: boolean) => void;
};

export function MicSettings({
  micDevices,
  selectedDeviceId,
  noiseFilter,
  selfMonitor,
  onSelectDevice,
  onToggleNoiseFilter,
  onToggleSelfMonitor,
}: Readonly<Props>) {
  const hasSelectedDevice = micDevices.some((device) => device.deviceId === selectedDeviceId);

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
        <Label htmlFor="noise-filter">Filtro de ruído</Label>
        <Switch id="noise-filter" checked={noiseFilter} onCheckedChange={onToggleNoiseFilter} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <Label htmlFor="self-monitor">Ouvir minha voz</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Use fones para evitar eco.</p>
        </div>
        <Switch id="self-monitor" checked={selfMonitor} onCheckedChange={onToggleSelfMonitor} />
      </div>
    </div>
  );
}
