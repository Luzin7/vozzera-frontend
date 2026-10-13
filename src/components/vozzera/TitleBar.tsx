export function TitleBar() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 flex h-[env(titlebar-area-height,0px)] items-center gap-2 overflow-hidden bg-background pl-[calc(env(titlebar-area-x,0px)+0.75rem)] text-xs font-medium text-muted-foreground [-webkit-app-region:drag] [app-region:drag]"
    >
      <img src="/icons/glyph.svg" alt="" className="h-4 w-4" />
      Vozzera
    </div>
  );
}
