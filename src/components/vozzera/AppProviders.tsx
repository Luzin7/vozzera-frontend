import { type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
