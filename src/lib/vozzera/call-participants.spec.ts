import { describe, expect, it, vi } from "vitest";

import {
  callParticipantFrom,
  findShareByIdentity,
  migrateScreenShareVolumeKey,
  migrateVolumeKey,
  omitIdentity,
  setIdentityValue,
} from "./call-participants";

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  } as Storage;
}

const VOLUMES_KEY = "vozzera.participantVolumes";
const SHARE_VOLUMES_KEY = "vozzera.screenShareVolumes";
const luan = { identity: "id-1", name: "Luan" };

describe("callParticipantFrom", () => {
  it("uses identity as the display name fallback", () => {
    expect(callParticipantFrom({ identity: "id-1", name: "" }, "id-2")).toEqual({
      identity: "id-1",
      name: "id-1",
      isLocal: false,
    });
  });

  it("flags the local participant by identity", () => {
    expect(callParticipantFrom({ identity: "id-1", name: "Luan" }, "id-1").isLocal).toBe(true);
  });
});

describe("findShareByIdentity", () => {
  const shares = [
    { identity: "id-1", name: "Ana" },
    { identity: "id-2", name: "Ana" },
  ];

  it("matches by identity even when names collide", () => {
    expect(findShareByIdentity(shares, "id-2")).toBe(shares[1]);
  });

  it("returns undefined without a share", () => {
    expect(findShareByIdentity(shares, "id-3")).toBeUndefined();
  });
});

describe("omitIdentity / setIdentityValue", () => {
  it("removes only the identity key", () => {
    expect(omitIdentity({ a: 1, b: 2 }, "a")).toEqual({ b: 2 });
  });

  it("returns the same reference when the key is absent", () => {
    const map = { a: 1 };
    expect(omitIdentity(map, "z")).toBe(map);
  });

  it("keeps two same-named people apart", () => {
    const next = setIdentityValue({ "id-1": true }, "id-2", false);
    expect(next).toEqual({ "id-1": true, "id-2": false });
  });
});

describe("migrateVolumeKey", () => {
  it("moves the name entry to the identity", () => {
    const storage = fakeStorage({ [VOLUMES_KEY]: JSON.stringify({ Luan: 0.4, Ana: 1 }) });
    expect(migrateVolumeKey(storage, luan)).toBe(true);
    expect(JSON.parse(storage.getItem(VOLUMES_KEY) ?? "")).toEqual({ "id-1": 0.4, Ana: 1 });
  });

  it("migrates once", () => {
    const storage = fakeStorage({ [VOLUMES_KEY]: JSON.stringify({ Luan: 0.4 }) });
    migrateVolumeKey(storage, luan);
    expect(migrateVolumeKey(storage, luan)).toBe(false);
  });

  it("never overwrites an existing identity value", () => {
    const storage = fakeStorage({ [VOLUMES_KEY]: JSON.stringify({ Luan: 0.4, "id-1": 1.5 }) });
    migrateVolumeKey(storage, luan);
    expect(JSON.parse(storage.getItem(VOLUMES_KEY) ?? "")["id-1"]).toBe(1.5);
  });

  it("removes the stale name entry when the identity value already exists", () => {
    const storage = fakeStorage({ [VOLUMES_KEY]: JSON.stringify({ Luan: 0.4, "id-1": 1.5 }) });
    expect(migrateVolumeKey(storage, luan)).toBe(true);
    expect(JSON.parse(storage.getItem(VOLUMES_KEY) ?? "")).toEqual({ "id-1": 1.5 });
  });

  it("is a no-op when nothing is saved", () => {
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, "setItem");
    expect(migrateVolumeKey(storage, luan)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("is a no-op when identity equals name", () => {
    const storage = fakeStorage({ [VOLUMES_KEY]: JSON.stringify({ x: 0.4 }) });
    expect(migrateVolumeKey(storage, { identity: "x", name: "x" })).toBe(false);
  });

  it("tolerates storage that throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(migrateVolumeKey(storage, luan)).toBe(false);
  });

  it("tolerates a null storage and corrupt data", () => {
    expect(migrateVolumeKey(null, luan)).toBe(false);
    expect(migrateVolumeKey(fakeStorage({ [VOLUMES_KEY]: "{oops" }), luan)).toBe(false);
  });
});

describe("migrateScreenShareVolumeKey", () => {
  it("uses the screen share storage key", () => {
    const storage = fakeStorage({
      [SHARE_VOLUMES_KEY]: JSON.stringify({ Luan: 0.2 }),
      [VOLUMES_KEY]: JSON.stringify({ Luan: 0.9 }),
    });
    expect(migrateScreenShareVolumeKey(storage, luan)).toBe(true);
    expect(JSON.parse(storage.getItem(SHARE_VOLUMES_KEY) ?? "")).toEqual({ "id-1": 0.2 });
    expect(JSON.parse(storage.getItem(VOLUMES_KEY) ?? "")).toEqual({ Luan: 0.9 });
  });
});
