import { describe, expect, it } from "vitest";

import {
  buildCommandActions,
  commandActionSearchValue,
  filterCommandActions,
  isCommandPaletteShortcut,
  type CommandShortcutEvent,
} from "@/lib/vozzera/command-actions";
import type { Room } from "@/lib/vozzera/types";

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: "r1",
    name: "geral",
    created_by: null,
    has_voice: false,
    staff_only: false,
    created_at: "2026-11-05T10:00:00.000Z",
    ...overrides,
  };
}

function ids(actions: ReturnType<typeof buildCommandActions>): string[] {
  return actions.map((action) => action.id);
}

function shortcut(overrides: Partial<CommandShortcutEvent> = {}): CommandShortcutEvent {
  return {
    key: "k",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    tagName: "BODY",
    contentEditable: false,
    ...overrides,
  };
}

describe("buildCommandActions", () => {
  it("lists the rooms in the given order", () => {
    const actions = buildCommandActions({
      rooms: [room({ id: "r1", name: "Geral" }), room({ id: "r2", name: "Avisos" })],
      canCreateRoom: false,
      canFocusSearch: false,
      notificationsEnabled: false,
    });
    expect(ids(actions)).toEqual([
      "select-room:r1",
      "select-room:r2",
      "open-settings",
      "toggle-notifications",
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      "Geral",
      "Avisos",
      "Configurações",
      "Notificações",
    ]);
  });

  it("adds the search action only when allowed", () => {
    const withoutSearch = buildCommandActions({
      rooms: [room()],
      canCreateRoom: false,
      canFocusSearch: false,
      notificationsEnabled: false,
    });
    const withSearch = buildCommandActions({
      rooms: [room()],
      canCreateRoom: false,
      canFocusSearch: true,
      notificationsEnabled: false,
    });
    expect(ids(withoutSearch)).not.toContain("focus-search");
    expect(ids(withSearch)).toContain("focus-search");
  });

  it("adds the create-room action only when allowed", () => {
    const withoutCreate = buildCommandActions({
      rooms: [room()],
      canCreateRoom: false,
      canFocusSearch: false,
      notificationsEnabled: false,
    });
    const withCreate = buildCommandActions({
      rooms: [room()],
      canCreateRoom: true,
      canFocusSearch: false,
      notificationsEnabled: false,
    });
    expect(ids(withoutCreate)).not.toContain("create-room");
    expect(ids(withCreate)).toContain("create-room");
  });

  it("always offers settings and notifications", () => {
    const actions = buildCommandActions({
      rooms: [room()],
      canCreateRoom: false,
      canFocusSearch: false,
      notificationsEnabled: true,
    });
    expect(ids(actions)).toContain("open-settings");
    expect(ids(actions)).toContain("toggle-notifications");
  });

  it("describes the notification action by the current state", () => {
    const hintFor = (notificationsEnabled: boolean) =>
      buildCommandActions({
        rooms: [room()],
        canCreateRoom: false,
        canFocusSearch: false,
        notificationsEnabled,
      }).find((action) => action.id === "toggle-notifications")?.hint;

    expect(hintFor(true)).toBe("Desativar notificações de desktop");
    expect(hintFor(false)).toBe("Ativar notificações de desktop");
  });
});

describe("filterCommandActions", () => {
  const actions = buildCommandActions({
    rooms: [room({ id: "r1", name: "Histórico" })],
    canCreateRoom: true,
    canFocusSearch: true,
    notificationsEnabled: false,
  });

  it("returns every action for an empty query", () => {
    expect(ids(filterCommandActions(actions, "  "))).toEqual(ids(actions));
  });

  it("matches labels ignoring case and accents", () => {
    expect(ids(filterCommandActions(actions, "historico"))).toEqual([
      "select-room:r1",
      "focus-search",
    ]);
    expect(ids(filterCommandActions(actions, "HISTÓRICO"))).toEqual([
      "select-room:r1",
      "focus-search",
    ]);
  });

  it("matches keywords and hints", () => {
    expect(ids(filterCommandActions(actions, "criar"))).toEqual(["create-room"]);
    expect(ids(filterCommandActions(actions, "dialogo"))).toEqual(["create-room"]);
    expect(ids(filterCommandActions(actions, "pesquisar"))).toEqual(["focus-search"]);
    expect(ids(filterCommandActions(actions, "configuracoes"))).toEqual(["open-settings"]);
    expect(ids(filterCommandActions(actions, "sino"))).toEqual(["toggle-notifications"]);
  });

  it("drops actions without a match", () => {
    expect(filterCommandActions(actions, "inexistente")).toEqual([]);
  });
});

describe("commandActionSearchValue", () => {
  it("carries the raw and the normalized label so cmdk filters both ways", () => {
    const actions = buildCommandActions({
      rooms: [room({ id: "r1", name: "Ações" })],
      canCreateRoom: false,
      canFocusSearch: false,
      notificationsEnabled: false,
    });
    const value = commandActionSearchValue(actions[0]!);
    expect(value).toContain("Ações");
    expect(value).toContain("acoes");
  });
});

describe("isCommandPaletteShortcut", () => {
  it("accepts Ctrl+K and Cmd+K", () => {
    expect(isCommandPaletteShortcut(shortcut())).toBe(true);
    expect(isCommandPaletteShortcut(shortcut({ ctrlKey: false, metaKey: true }))).toBe(true);
  });

  it("ignores other keys and modifier combinations", () => {
    expect(isCommandPaletteShortcut(shortcut({ key: "j" }))).toBe(false);
    expect(isCommandPaletteShortcut(shortcut({ shiftKey: true }))).toBe(false);
    expect(isCommandPaletteShortcut(shortcut({ altKey: true }))).toBe(false);
    expect(isCommandPaletteShortcut(shortcut({ ctrlKey: false, metaKey: false }))).toBe(false);
    expect(isCommandPaletteShortcut(shortcut({ repeat: true }))).toBe(false);
  });

  it("does not fire while the user is typing", () => {
    expect(isCommandPaletteShortcut(shortcut({ tagName: "TEXTAREA" }))).toBe(false);
    expect(isCommandPaletteShortcut(shortcut({ tagName: "INPUT" }))).toBe(false);
    expect(isCommandPaletteShortcut(shortcut({ tagName: "DIV", contentEditable: true }))).toBe(
      false,
    );
  });
});
