import type { ReactNode } from "react";

export function AppViewport({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mt-[env(titlebar-area-height,0px)] flex h-[calc(100dvh_-_env(titlebar-area-height,0px))] overflow-hidden bg-background">
      {children}
    </div>
  );
}
