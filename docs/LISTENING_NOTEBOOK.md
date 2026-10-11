# Listening Notebook

In the Komuz Listening Room (`/culture/komuz/listen`), under the player.
It uses the **existing** komuz player (`useKomuzPlayerStore`); there is no
second player.

## Flow

1. Play a bundled recording.
2. Tap **Save this moment (0:42)**. The position stored is the one the
   existing player reports at the moment of the tap (`state.position`),
   rounded to 0.1 s and clamped to 0..duration when the duration is known.
3. Write a personal observation ("Your observation (personal note)").
   Saving or editing a note never plays, pauses or seeks; a test checks
   that the player isn't called.
4. Moments are grouped by track, in timestamp order.
5. Tap a time:
   - **Same track playing, duration known:** `seek()`, clamped to
     0..duration.
   - **Another track:** `playFrom(track, seconds)`, which already clamps to
     `duration - 1` once the player reports a duration.
   - **Current track with no reported duration (not seekable yet):** an
     explanation; the note is kept.
   - **Recording no longer in the app:** "This recording isn't available
     now"; the notes stay.

## Data

Each moment stores:
- the stable `trackId` (komuzTracks);
- `seconds`;
- `titleSnapshot`;
- `note`;
- created/updated times.

Notes are the listener's own words. Nothing about the music is generated.

## Storage, failure, accounts

- `oyno.listeningNotebook.v1`: `{ <owner>: { <id>: moment } }`, on this
  device, at most 300 moments.
- **Write first, then show.** A failed save keeps the text, or the CAPTURED
  time, for Retry: retrying a failed capture saves the original moment, not
  the time of the retry.
- A failed or unreadable load is an error state with Retry that blocks
  writes.
- Switching account shows that account's notebook only.

## Backup / export (actual behaviour)

- The notebook is **not** synced and **not** in the learning-data export.
- The existing "Save point" listening bookmarks (no notes) ARE part of the
  export's `listening` domain and of Private Cloud Sync. The notebook is
  deliberately separate, so the synced bookmark schema is unchanged.
- Clearing app data or uninstalling removes the notebook. The screen says so.

## Accessibility fixes found on the way

- The playback-position slider had no `aria-valuenow` on web (axe: critical).
  It now passes the ARIA values directly.
- The room's terracotta headings were 3.47:1. They now use the text-safe
  shade.

## Tests

- `listening/notebook.test.ts`:
  - capture uses and clamps the reported position;
  - seek plans (clamped seek, playFrom, not seekable, missing);
  - grouping and timestamp order, with unknown tracks kept;
  - store: per owner, restart, a failed write changes nothing, unreadable
    data blocks writes;
  - component: save -> failed note -> Retry; the player is untouched by
    saving and editing; tapping seeks the same player; a failed capture
    retries the captured time; a missing recording keeps its note; another
    account sees none.
- `e2e/tests/listening-notebook.spec.ts` (headless Chromium plays the
  bundled mp3):
  - save moment -> note -> axe -> reload -> note kept -> play past the
    moment -> tap it -> the player is back at that second (stable over
    repeated runs);
  - RU: a missing recording keeps its note.

## Needs a physical device (PENDING)

- iOS/Android: seeking accuracy with the native `expo-audio` player, and
  saving a moment while the screen reader is speaking.
- Interruptions such as a call, or audio focus taken by another app,
  between saving and seeking.
- TalkBack/VoiceOver reading of the time buttons ("Go to 42 seconds in …").
