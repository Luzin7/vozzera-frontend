import { Loader2 } from "lucide-react";

type Props = {
  visible: boolean;
};

export function ConnectionStatusBanner({ visible }: Readonly<Props>) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-border bg-muted px-4 py-1.5 text-xs text-muted-foreground"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      <span>Reconectando…</span>
    </div>
  );
}
