import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
};

export function NotificationsNudge({ visible, onEnable, onDismiss }: Readonly<Props>) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground"
    >
      <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">Quer ser avisado quando chegarem mensagens?</span>
      <Button size="sm" className="h-8" onClick={onEnable}>
        Ativar
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onDismiss}>
        Agora não
      </Button>
    </div>
  );
}
