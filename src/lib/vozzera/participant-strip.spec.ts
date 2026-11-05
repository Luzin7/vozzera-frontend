import { describe, expect, it } from "vitest";

import type { CallTile } from "./away";
import {
  PARTICIPANT_STRIP_KEY,
  orderStripTiles,
  readStripVisible,
  shouldRenderStrip,
  writeStripVisible,
} from "./participant-strip";

function tile(identity: string, overrides: Partial<CallTile> = {}): CallTile {
  return { identity, name: identity, isLocal: false, isAway: false, ...overrides };
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  } as Storage;
}

describe("orderStripTiles", () => {
  it("puts self first, present participants next and away last, keeping relative order", () => {
    const ordered = orderStripTiles([
      tile("away-1", { isAway: true }),
      tile("b"),
      tile("me", { isLocal: true }),
      tile("a"),
    ]);
    expect(ordered.map((item) => item.identity)).toEqual(["me", "b", "a", "away-1"]);
  });

  it("does not mutate the input", () => {
    const input = [tile("b"), tile("me", { isLocal: true })];
    orderStripTiles(input);
    expect(input.map((item) => item.identity)).toEqual(["b", "me"]);
  });

  it("returns an empty list for no tiles", () => {
    expect(orderStripTiles([])).toEqual([]);
  });
});

describe("shouldRenderStrip", () => {
  it("renders when visible and there are tiles", () => {
    expect(shouldRenderStrip(true, 2)).toBe(true);
  });

  it("does not render when hidden or empty", () => {
    expect(shouldRenderStrip(false, 2)).toBe(false);
    expect(shouldRenderStrip(true, 0)).toBe(false);
  });
});

describe("strip visibility storage", () => {
  it("defaults to shown without storage or value", () => {
    expect(readStripVisible(null)).toBe(true);
    expect(readStripVisible(memoryStorage())).toBe(true);
  });

  it("persists hidden and shown under the named key", () => {
    const storage = memoryStorage();
    writeStripVisible(storage, false);
    expect(storage.getItem(PARTICIPANT_STRIP_KEY)).toBe("hidden");
    expect(readStripVisible(storage)).toBe(false);
    writeStripVisible(storage, true);
    expect(readStripVisible(storage)).toBe(true);
  });

  it("ignores unknown values", () => {
    expect(readStripVisible(memoryStorage({ [PARTICIPANT_STRIP_KEY]: "x" }))).toBe(true);
  });

  it("does not throw when storage fails", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    expect(readStripVisible(broken)).toBe(true);
    expect(() => writeStripVisible(broken, false)).not.toThrow();
  });
});
