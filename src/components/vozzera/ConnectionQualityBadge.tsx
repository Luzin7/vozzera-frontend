import { SignalHigh, SignalLow, SignalMedium, SignalZero } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { connectionQualityIndicatorFor } from "@/lib/vozzera/connection-quality";

const ICONS = [SignalZero, SignalLow, SignalMedium, SignalHigh];
const COLORS = ["text-destructive", "text-destructive", "text-muted-foreground", "text-foreground"];

export function ConnectionQualityBadge({ quality }: Readonly<{ quality: string | undefined }>) {
  const indicator = connectionQualityIndicatorFor(quality);
  if (!indicator) return null;

  const Icon = ICONS[indicator.level] ?? SignalZero;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={indicator.label}
          tabIndex={0}
          className={`inline-flex shrink-0 items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${COLORS[indicator.level]}`}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {indicator.shortLabel && (
            <span aria-hidden="true" className="text-xs font-medium">
              {indicator.shortLabel}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{indicator.label}</TooltipContent>
    </Tooltip>
  );
}
