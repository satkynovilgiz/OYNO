# Listening Compare

- **Entry:** Listening Room → "Compare two recordings" (`/culture/komuz/compare`).
- **Session:** `/culture/komuz/compare/[comparisonId]`, private in the route sanitizer.
- **Code:**
  - `src/features/culture/komuz/listening/compareModel.ts`
  - `ListeningCompareScreens.tsx`
  - `src/store/useListeningCompareStore.ts` (`oyno.listeningCompare.v1`)

## Behaviour

1. **Choosing:** pick Recording A and Recording B from the bundled komuz recordings. They must
   be different and available.
2. **Playback:** uses the **existing single player** (`useKomuzPlayerStore`).
   - "Recording A" and "Recording B" are explicit switches. Loading one releases the other, so the
     two never play together.
   - The comparison plays with a one-track queue, so a recording that ends never advances into a
     third one. The only player change was an optional `queue` argument on `playFrom`.
3. **Positions:** each recording's position is remembered separately in memory (per owner,
   comparison and side). Going back to a recording restores its position through the player's
   real `seekTo`, and only once the player reports a real duration. Until then the screen says
   the recording can't jump to a point yet.
4. **Moments:** "Save this moment (m:ss)" captures the player's current position into the
   existing **Listening Notebook**. The comparison stores the moment id and a snapshot of the
   seconds. "Go to this moment" seeks, or starts that recording at that point.
5. **Comparison note:** labelled as the listener's own observations, not facts about the music.
   Saving the note never touches the player.
6. **Missing recording:** the side says the recording is unavailable. Its moment and the note
   stay, and there's no "Go to" button.
7. **No alignment:** recordings are never synced, and sections are never assumed to match.
   Metadata is limited to the title, plus the performer only when the title is confirmed;
   otherwise the existing "title unconfirmed" label is shown.
8. **Interruptions:** the player's existing rules apply. It pauses on background and when the
   Audio Guide starts, stops on an account change, and stops when the last komuz screen closes
   (`registerKomuzHost`).
9. **Storage:** per owner and serialized write-first. A failed save keeps the edit in the field
   with Retry, and an unreadable store blocks writes. Stored on this device only: not synced, not
   in the data export.

## Tests

- `src/features/culture/komuz/listening/compare.test.ts`, which drives the real player store with a
  mocked expo-audio:
  - switching releases the previous player;
  - a remembered seek waits for a real duration;
  - no auto-advance;
  - switch plans and separate positions;
  - missing tracks;
  - per-owner store and failed saves.
- `e2e/tests/listening-compare.spec.ts` uses the real bundled mp3s in Chromium:
  - A → moment → B (A stops, its position is kept) → moment → note (playback continues) → back
    to A (from its own place) → reload → reopen → go to a moment, with Notebook linkage checked;
  - a missing recording (RU).

## Native audio checks needing a device (PENDING)

- iOS and Android: switching A and B stops the first recording with no overlap or click, and
  seeking lands on the remembered point after loading.
- Interruptions: a phone call or Siri / Google Assistant, headphones unplugged, Bluetooth
  disconnecting, the silent switch on iOS, and backgrounding then returning.
- A screen reader (VoiceOver / TalkBack) announcing the switches, the time readout and saved
  moments.
