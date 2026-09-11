import { describe, expect, it } from "vitest";

import { voiceActionNotesFor, type VoiceActionSound } from "./voice-sounds";

describe("voiceActionNotesFor", () => {
  const actions: VoiceActionSound[] = [
    "join",
    "leave",
    "mute",
    "unmute",
    "screen-share-start",
    "screen-share-stop",
  ];

  it.each(actions)("returns an audible profile for %s", (action) => {
    const notes = voiceActionNotesFor(action);

    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((note) => note.frequency > 0)).toBe(true);
    expect(notes.every((note) => note.duration > 0)).toBe(true);
    expect(notes.every((note) => note.gain >= 0.2)).toBe(true);
  });

  it("returns a copy that cannot change the shared profile", () => {
    const notes = voiceActionNotesFor("join");
    const [firstNote] = notes;
    if (!firstNote) throw new Error("Expected a join sound note");
    firstNote.frequency = 1;

    expect(voiceActionNotesFor("join").map((note) => note.frequency)).toEqual([440, 660]);
  });

  it("uses rising notes for positive actions and falling notes for negative actions", () => {
    expect(voiceActionNotesFor("join").map((note) => note.frequency)).toEqual([440, 660]);
    expect(voiceActionNotesFor("leave").map((note) => note.frequency)).toEqual([620, 390]);
    expect(voiceActionNotesFor("screen-share-start").map((note) => note.frequency)).toEqual([
      480, 720,
    ]);
    expect(voiceActionNotesFor("screen-share-stop").map((note) => note.frequency)).toEqual([
      680, 420,
    ]);
  });
});
