import { Track } from "livekit-client";

export type WatchIntents = ReadonlySet<string>;

export type LiveShare = {
  identity: string;
  name: string;
};

export type SharePublicationContract = {
  source: string;
  setSubscribed: (subscribed: boolean) => void;
};

export type ShareParticipantContract = {
  identity: string;
  name?: string;
  trackPublications: { values: () => Iterable<SharePublicationContract> };
};

const SHARE_VIDEO_SOURCE: string = Track.Source.ScreenShare;
const SHARE_AUDIO_SOURCE: string = Track.Source.ScreenShareAudio;

export function isShareSource(source: string): boolean {
  return source === SHARE_VIDEO_SOURCE || source === SHARE_AUDIO_SOURCE;
}

export function shouldSubscribe(identity: string, intents: WatchIntents): boolean {
  return intents.has(identity);
}

export function shouldAcceptSubscribedShare(identity: string, intents: WatchIntents): boolean {
  return shouldSubscribe(identity, intents);
}

export function addWatchIntent(intents: WatchIntents, identity: string): WatchIntents {
  return new Set(intents).add(identity);
}

export function removeWatchIntent(intents: WatchIntents, identity: string): WatchIntents {
  const next = new Set(intents);
  next.delete(identity);
  return next;
}

export function applyWatchIntent(
  identity: string,
  publication: SharePublicationContract,
  intents: WatchIntents,
): void {
  if (!isShareSource(publication.source)) return;
  publication.setSubscribed(shouldSubscribe(identity, intents));
}

export function applyWatchIntentToParticipant(
  participant: ShareParticipantContract,
  intents: WatchIntents,
): void {
  for (const publication of participant.trackPublications.values()) {
    applyWatchIntent(participant.identity, publication, intents);
  }
}

function publishesScreenShare(participant: ShareParticipantContract): boolean {
  for (const publication of participant.trackPublications.values()) {
    if (publication.source === SHARE_VIDEO_SOURCE) return true;
  }
  return false;
}

export function deriveAvailableShares(
  participants: Iterable<ShareParticipantContract>,
): LiveShare[] {
  const shares: LiveShare[] = [];
  for (const participant of participants) {
    if (!publishesScreenShare(participant)) continue;
    shares.push({ identity: participant.identity, name: participant.name || participant.identity });
  }
  return shares;
}
