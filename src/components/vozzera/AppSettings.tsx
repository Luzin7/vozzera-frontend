import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { InstallOption } from "@/lib/vozzera/pwa";

type Props = {
  installOption: InstallOption;
  appBadgeEnabled: boolean;
  miniWindowSupported: boolean;
  onInstall: () => void;
  onToggleAppBadge: (enabled: boolean) => void;
};

const INSTALL_MESSAGES: Record<Exclude<InstallOption, "prompt">, string> = {
  installed: "O Vozzera já está instalado como app neste dispositivo.",
  ios: "No iPhone ou iPad, toque em Compartilhar e depois em Adicionar à Tela de Início.",
  unavailable:
    "Este navegador não instala apps. No computador, abra o Vozzera no Chrome ou no Edge pra instalar.",
};

function InstallSection({
  installOption,
  onInstall,
}: Readonly<Pick<Props, "installOption" | "onInstall">>) {
  if (installOption !== "prompt") {
    return <p className="text-sm text-muted-foreground">{INSTALL_MESSAGES[installOption]}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Abre numa janela própria, com ícone na barra de tarefas, sem precisar procurar a aba do
        navegador.
      </p>
      <Button className="min-h-11" onClick={onInstall}>
        <Download className="h-4 w-4" />
        Instalar o Vozzera
      </Button>
    </div>
  );
}

export function AppSettings({
  installOption,
  appBadgeEnabled,
  miniWindowSupported,
  onInstall,
  onToggleAppBadge,
}: Readonly<Props>) {
  return (
    <div className="space-y-5">
      <InstallSection installOption={installOption} onInstall={onInstall} />

      <div className="flex items-center justify-between gap-2 border-t border-border pt-5">
        <div>
          <Label htmlFor="app-badge-toggle">Não lidas no ícone do app</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mostra no ícone do app instalado quantas mensagens você ainda não leu.
          </p>
        </div>
        <Switch
          id="app-badge-toggle"
          checked={appBadgeEnabled}
          onCheckedChange={onToggleAppBadge}
        />
      </div>

      {miniWindowSupported && (
        <p className="border-t border-border pt-5 text-xs text-muted-foreground">
          Durante uma chamada, o botão de mini janela abre os controles de voz numa janela pequena
          que fica por cima das outras. Só abre quando você clicar.
        </p>
      )}
    </div>
  );
}
