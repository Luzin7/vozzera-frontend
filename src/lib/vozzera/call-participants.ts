import type { LiveShare } from "./screen-share-watch";

const PARTICIPANT_VOLUMES_KEY = "vozzera.participantVolumes";
const SCREEN_SHARE_VOLUMES_KEY = "vozzera.screenShareVolumes";

export type CallParticipant = {
  identity: string;
  name: string;
  isLocal: boolean;
};

type ParticipantContract = { identity: string; name?: string };
type ParticipantKeys = { identity: string; name: string };

export function callParticipantFrom(
  participant: ParticipantContract,
  localIdentity: string,
): CallParticipant {
  return {
    identity: participant.identity,
    name: participant.name || participant.identity,
    isLocal: participant.identity === localIdentity,
  };
}

export function reuseCallParticipants(
  prev: CallParticipant[],
  next: CallParticipant[],
): CallParticipant[] {
  const prevByIdentity = new Map(prev.map((participant) => [participant.identity, participant]));
  const reused = next.map((participant) => {
    const previous = prevByIdentity.get(participant.identity);
    const unchanged =
      previous !== undefined &&
      previous.name === participant.name &&
      previous.isLocal === participant.isLocal;
    return unchanged ? previous : participant;
  });
  const sameList =
    reused.length === prev.length &&
    reused.every((participant, index) => participant === prev[index]);
  return sameList ? prev : reused;
}

export function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function findShareByIdentity(shares: LiveShare[], identity: string): LiveShare | undefined {
  return shares.find((share) => share.identity === identity);
}

export function setIdentityValue<T>(
  map: Record<string, T>,
  identity: string,
  value: T,
): Record<string, T> {
  if (map[identity] === value) return map;
  return { ...map, [identity]: value };
}

export function omitIdentity<T>(map: Record<string, T>, identity: string): Record<string, T> {
  if (!(identity in map)) return map;
  const next = { ...map };
  delete next[identity];
  return next;
}

function readVolumeMap(storage: Storage, storageKey: string): Record<string, unknown> | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function migrateKey(
  storage: Storage | null,
  storageKey: string,
  { identity, name }: ParticipantKeys,
): boolean {
  if (!storage || identity === name) return false;

  try {
    const saved = readVolumeMap(storage, storageKey);
    if (!saved || !(name in saved)) return false;

    const { [name]: legacyValue, ...rest } = saved;
    const migrated = identity in rest ? rest : { ...rest, [identity]: legacyValue };
    storage.setItem(storageKey, JSON.stringify(migrated));
    return true;
  } catch {
    return false;
  }
}

export function migrateVolumeKey(storage: Storage | null, participant: ParticipantKeys): boolean {
  return migrateKey(storage, PARTICIPANT_VOLUMES_KEY, participant);
}

export function migrateScreenShareVolumeKey(
  storage: Storage | null,
  participant: ParticipantKeys,
): boolean {
  return migrateKey(storage, SCREEN_SHARE_VOLUMES_KEY, participant);
}

export function migrateLegacyVolumeKeysOnce(
  migratedIdentities: Set<string>,
  storage: Storage | null,
  participant: ParticipantKeys,
): { volumes: boolean; screenShareVolumes: boolean } {
  if (migratedIdentities.has(participant.identity)) {
    return { volumes: false, screenShareVolumes: false };
  }
  migratedIdentities.add(participant.identity);
  return {
    volumes: migrateVolumeKey(storage, participant),
    screenShareVolumes: migrateScreenShareVolumeKey(storage, participant),
  };
}
