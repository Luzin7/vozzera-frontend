import { SignalHigh, SignalLow, SignalMedium, SignalZero } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { connectionQualityIndicatorFor } from "@/lib/vozzera/connection-quality";

const ICONS = [SignalZero, SignalLow, SignalMedium, SignalHigh];
const COLORS = [
  "text-destructive",
  "text-destructive",
  "text-muted-foreground",
  "text-muted-foreground",
];

export function ConnectionQualityBadge({ quality }: Readonly<{ quality: string | undefined }>) {
  const indicator = connectionQualityIndicatorFor(quality);
  if (!indicator) return null;

  const Icon = ICONS[indicator.level] ?? SignalZero;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">
            <Icon
              aria-label={indicator.label}
              className={`h-3.5 w-3.5 ${COLORS[indicator.level]}`}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{indicator.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
