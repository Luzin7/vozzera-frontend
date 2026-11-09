import { normalizeSearchText } from "@/lib/vozzera/message-search";
import type { Room } from "@/lib/vozzera/types";

export type CommandActionKind =
  "select-room" | "focus-search" | "create-room" | "open-settings" | "toggle-notifications";

export type CommandAction = {
  id: string;
  kind: CommandActionKind;
  label: string;
  hint: string;
  group: string;
  keywords: readonly string[];
  roomId?: string;
};

export const COMMAND_GROUP_ROOMS = "Salas";
export const COMMAND_GROUP_ACTIONS = "Ações";

export type CommandActionContext = {
  rooms: readonly Room[];
  canCreateRoom: boolean;
  canFocusSearch: boolean;
  notificationsEnabled: boolean;
};

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function actionSearchFields(action: CommandAction): string[] {
  return [action.label, action.hint, ...action.keywords];
}

export function buildCommandActions({
  rooms,
  canCreateRoom,
  canFocusSearch,
  notificationsEnabled,
}: CommandActionContext): CommandAction[] {
  const roomActions = rooms.map((room): CommandAction => ({
    id: `select-room:${room.id}`,
    kind: "select-room",
    label: room.name,
    hint: "Ir para a sala de texto",
    group: COMMAND_GROUP_ROOMS,
    keywords: ["sala", "texto", "trocar"],
    roomId: room.id,
  }));
  const actions = [...roomActions];

  if (canFocusSearch) {
    actions.push({
      id: "focus-search",
      kind: "focus-search",
      label: "Buscar nas mensagens",
      hint: "Filtrar o histórico carregado desta sala",
      group: COMMAND_GROUP_ACTIONS,
      keywords: ["buscar", "pesquisar", "mensagens", "historico"],
    });
  }

  if (canCreateRoom) {
    actions.push({
      id: "create-room",
      kind: "create-room",
      label: "Criar sala",
      hint: "Abrir o diálogo de nova sala",
      group: COMMAND_GROUP_ACTIONS,
      keywords: ["nova", "sala", "criar"],
    });
  }

  actions.push({
    id: "open-settings",
    kind: "open-settings",
    label: "Configurações",
    hint: "Abrir as configurações do aplicativo",
    group: COMMAND_GROUP_ACTIONS,
    keywords: ["configuracoes", "ajustes", "preferencias"],
  });

  actions.push({
    id: "toggle-notifications",
    kind: "toggle-notifications",
    label: "Notificações",
    hint: notificationsEnabled
      ? "Desativar notificações de desktop"
      : "Ativar notificações de desktop",
    group: COMMAND_GROUP_ACTIONS,
    keywords: ["notificacoes", "desktop", "avisos", "sino"],
  });

  return actions;
}

export function commandActionSearchValue(action: CommandAction): string {
  const raw = actionSearchFields(action).join(" ");
  return `${raw} ${normalizeSearchText(raw)}`;
}

export function filterCommandActions(
  actions: readonly CommandAction[],
  query: string,
): CommandAction[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (normalizedQuery.length === 0) return [...actions];

  return actions.filter((action) =>
    actionSearchFields(action).some((field) =>
      normalizeSearchText(field).includes(normalizedQuery),
    ),
  );
}

export type CommandShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  tagName: string | undefined;
  contentEditable: boolean;
};

export function isCommandPaletteShortcut(event: CommandShortcutEvent): boolean {
  if (event.repeat || event.altKey || event.shiftKey) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.contentEditable) return false;
  if (event.tagName !== undefined && TYPING_TAGS.has(event.tagName)) return false;
  return event.key.toLowerCase() === "k";
}
