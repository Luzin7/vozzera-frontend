import { useEffect, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { LabeledSlider } from "@/components/vozzera/LabeledSlider";
import { Switch } from "@/components/ui/switch";
import { reducePushToTalkCapture } from "@/lib/vozzera/push-to-talk-capture";
import { useMicLevelDb } from "@/lib/vozzera/speaking-store";
import { updateVoicePreferences, useVoicePreferences } from "@/lib/vozzera/voice-preferences";
import {
  MAX_PUSH_TO_TALK_RELEASE_DELAY_MS,
  MAX_SENSITIVITY_DB,
  MIN_SENSITIVITY_DB,
  levelToMeterPercent,
  pushToTalkLabelFor,
  type MicDevice,
} from "@/lib/vozzera/voice";

const RELEASE_DELAY_STEP_MS = 50;

function MicLevelMeter() {
  const levelDb = useMicLevelDb();
  return (
    <Progress
      value={levelToMeterPercent(levelDb)}
      aria-label="Nível do microfone"
      className="h-1.5"
    />
  );
}

function SensitivitySetting() {
  const { sensitivity } = useVoicePreferences();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label id="speech-sensitivity-label">Sensibilidade</Label>
        <div className="flex items-center gap-2">
          <Label htmlFor="speech-sensitivity-auto" className="text-xs text-muted-foreground">
            Automática
          </Label>
          <Switch
            id="speech-sensitivity-auto"
            checked={sensitivity.auto}
            onCheckedChange={(auto) =>
              updateVoicePreferences({ sensitivity: { ...sensitivity, auto } })
            }
          />
        </div>
      </div>
      <MicLevelMeter />
      <LabeledSlider
        labelId="speech-sensitivity-label"
        valueText={`${sensitivity.thresholdDb} dB`}
        min={MIN_SENSITIVITY_DB}
        max={MAX_SENSITIVITY_DB}
        step={1}
        value={[sensitivity.thresholdDb]}
        disabled={sensitivity.auto}
        onValueChange={([thresholdDb]) => {
          if (thresholdDb === undefined) return;
          updateVoicePreferences({ sensitivity: { ...sensitivity, thresholdDb } });
        }}
      />
    </div>
  );
}

function PushToTalkReleaseDelaySetting() {
  const { pushToTalkReleaseDelayMs } = useVoicePreferences();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label id="push-to-talk-release-delay-label">Atraso ao soltar a tecla</Label>
        <span className="text-xs text-muted-foreground">{pushToTalkReleaseDelayMs} ms</span>
      </div>
      <LabeledSlider
        labelId="push-to-talk-release-delay-label"
        valueText={`${pushToTalkReleaseDelayMs} ms`}
        min={0}
        max={MAX_PUSH_TO_TALK_RELEASE_DELAY_MS}
        step={RELEASE_DELAY_STEP_MS}
        value={[pushToTalkReleaseDelayMs]}
        onValueChange={([delayMs]) => {
          if (delayMs === undefined) return;
          updateVoicePreferences({ pushToTalkReleaseDelayMs: delayMs });
        }}
      />
    </div>
  );
}

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
  onPushToTalkCaptureChange: (capturing: boolean) => void;
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
  onPushToTalkCaptureChange,
}: Readonly<Props>) {
  const hasSelectedDevice = micDevices.some((device) => device.deviceId === selectedDeviceId);
  const [capturingPushToTalkKey, setCapturingPushToTalkKey] = useState(false);

  useEffect(() => {
    onPushToTalkCaptureChange(capturingPushToTalkKey);
    return () => onPushToTalkCaptureChange(false);
  }, [capturingPushToTalkKey, onPushToTalkCaptureChange]);

  useEffect(() => {
    if (!capturingPushToTalkKey) return;
    const cancelCapture = () => setCapturingPushToTalkKey(false);
    window.addEventListener("blur", cancelCapture);
    return () => window.removeEventListener("blur", cancelCapture);
  }, [capturingPushToTalkKey]);

  const capturePushToTalkKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturingPushToTalkKey || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    const { capturing, boundCode } = reducePushToTalkCapture(true, {
      type: "key",
      code: event.code,
    });
    setCapturingPushToTalkKey(capturing);
    if (boundCode) onPushToTalkKeyChange(boundCode, pushToTalkLabelFor(event.key, event.code));
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

      <SensitivitySetting />

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
          onClick={() =>
            setCapturingPushToTalkKey(reducePushToTalkCapture(false, { type: "start" }).capturing)
          }
          onBlur={() =>
            setCapturingPushToTalkKey(reducePushToTalkCapture(true, { type: "blur" }).capturing)
          }
          onKeyDown={capturePushToTalkKey}
        >
          {capturingPushToTalkKey ? "Aguardando…" : pushToTalkKeyLabel}
        </Button>
      </div>

      {pushToTalkEnabled && <PushToTalkReleaseDelaySetting />}
    </div>
  );
}
