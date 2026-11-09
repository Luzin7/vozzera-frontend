import { useEffect, useMemo, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import {
  buildCommandActions,
  commandActionSearchValue,
  filterCommandActions,
  isCommandPaletteShortcut,
  type CommandAction,
} from "@/lib/vozzera/command-actions";
import type { Room } from "@/lib/vozzera/types";

function groupByLabel(actions: readonly CommandAction[]): Array<[string, CommandAction[]]> {
  const groups = new Map<string, CommandAction[]>();

  for (const action of actions) {
    const group = groups.get(action.group) ?? [];
    group.push(action);
    groups.set(action.group, group);
  }

  return Array.from(groups.entries());
}

export function CommandPalette({
  open,
  onOpenChange,
  rooms,
  canCreateRoom,
  canFocusSearch,
  notificationsEnabled,
  onSelectRoom,
  onFocusSearch,
  onCreateRoom,
  onOpenSettings,
  onToggleNotifications,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: readonly Room[];
  canCreateRoom: boolean;
  canFocusSearch: boolean;
  notificationsEnabled: boolean;
  onSelectRoom: (room: Room) => void;
  onFocusSearch: () => void;
  onCreateRoom: () => void;
  onOpenSettings: () => void;
  onToggleNotifications: () => void;
}>) {
  const [query, setQuery] = useState("");
  const actions = useMemo(
    () =>
      buildCommandActions({
        rooms,
        canCreateRoom,
        canFocusSearch,
        notificationsEnabled,
      }),
    [rooms, canCreateRoom, canFocusSearch, notificationsEnabled],
  );
  const groups = useMemo(
    () => groupByLabel(filterCommandActions(actions, query)),
    [actions, query],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const actionHandlers = {
    "focus-search": onFocusSearch,
    "create-room": onCreateRoom,
    "open-settings": onOpenSettings,
    "toggle-notifications": onToggleNotifications,
  } satisfies Record<Exclude<CommandAction["kind"], "select-room">, () => void>;

  const runAction = (action: CommandAction) => {
    handleOpenChange(false);
    if (action.kind === "select-room") {
      const room = action.roomId
        ? rooms.find((candidate) => candidate.id === action.roomId)
        : undefined;
      if (room) onSelectRoom(room);
      return;
    }

    actionHandlers[action.kind]();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isShortcut = isCommandPaletteShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        tagName: target?.tagName,
        contentEditable: target?.isContentEditable ?? false,
      });
      if (!isShortcut) return;

      event.preventDefault();
      onOpenChange(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar salas e ações…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {groups.map(([group, groupActions]) => (
          <CommandGroup key={group} heading={group}>
            {groupActions.map((action) => (
              <CommandItem
                key={action.id}
                value={commandActionSearchValue(action)}
                onSelect={() => runAction(action)}
              >
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{action.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
