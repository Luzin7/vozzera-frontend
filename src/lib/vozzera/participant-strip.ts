import type { CallTile } from "@/lib/vozzera/away";

export const PARTICIPANT_STRIP_KEY = "vozzera:participant-strip";

const HIDDEN_VALUE = "hidden";
const SHOWN_VALUE = "shown";

export function orderStripTiles(tiles: readonly CallTile[]): CallTile[] {
  const rank = (tile: CallTile): number => {
    if (tile.isLocal) return 0;
    return tile.isAway ? 2 : 1;
  };
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((a, b) => rank(a.tile) - rank(b.tile) || a.index - b.index)
    .map(({ tile }) => tile);
}

export function shouldRenderStrip(visible: boolean, tileCount: number): boolean {
  return visible && tileCount > 0;
}

export function readStripVisible(storage: Storage | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(PARTICIPANT_STRIP_KEY) !== HIDDEN_VALUE;
  } catch {
    return true;
  }
}

export function writeStripVisible(storage: Storage | null, visible: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(PARTICIPANT_STRIP_KEY, visible ? SHOWN_VALUE : HIDDEN_VALUE);
  } catch {
    return;
  }
}
