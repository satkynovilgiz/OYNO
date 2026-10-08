# Repeat the Rhythm (2026-10-07)

A mode of the Komuz Rhythm Trainer. Route: `/culture/komuz/repeat`. It is
reached from the Listening Room ("Repeat the Rhythm") and from the Rhythm
Trainer's start screen.

- Code: `src/features/culture/komuz/rhythm/repeat/`
- Results: `src/store/useRhythmRepeatStore.ts`, key `oyno.rhythmRepeat.v1`

## Journey

1. Choose a difficulty. Optionally switch the example sound off.
2. Hear the short example; the lights show each note at the same moment.
3. Tap it back on the large pad.
4. Get timing feedback for each note and a tempo note. You can replay the
   example.
5. After five rounds, see the session summary.

## Content

There are six authored practice exercises: `even`, `pairs`, `long-short`,
`run`, `offbeat` and `skip` (in `repeatModel.ts`).

- The screen labels them as exercises written for OYNO and says they are not
  traditional komuz rhythms. No source verifies any of them as traditional.
- The notes in every pattern are at least half a beat apart.

| Level | Tempo | Patterns |
| --- | --- | --- |
| easy | 70 BPM | even, long-short, pairs |
| medium | 85 BPM | pairs, long-short, run, offbeat |
| hard | 100 BPM | run, offbeat, skip |

A session has 5 rounds. Every pattern of the level is used before any
repeats, and the same pattern never comes twice in a row.

## Scoring: relative timing

All of this is in `scoreTaps()`:

1. Taps closer than **80 ms** apart are one finger bounce. They are ignored
   and counted separately.
2. Tap k is matched to note k. A round ends when every note has a tap, after
   `max(2 s, 2.5 beats)` of silence, or when the player taps "Done". So taps
   can never outnumber notes.
3. The player's own start time and tempo are fitted by least squares. Each
   tap's deviation is then measured in beats of that tempo, so a slow and a
   fast version of the same performance score identically.
4. A deviation of **at most 0.12 beat** is on time (2 points). At most
   **0.25 beat** is close (1 point). Anything else is off (0). A note with
   no tap is missing (0).
5. If fewer than half the notes are tapped there is no timing credit, because
   two taps always fit perfectly.
6. Tempo is reported for information only and is never scored. Above 1.15×
   the example's beat length it counts as slower; below 0.87× it counts as
   faster.

In milliseconds, 0.12 beat is 103 ms at 70 BPM and 72 ms at 100 BPM.

## Timing, audio and interruptions

- Taps use `performance.now()` (monotonic) and are taken on press-in.
  - Out-of-phase, non-finite or backwards-in-time taps are ignored by the
    reducer.
  - On web, the press-in delay is set to 0. React Native Web otherwise
    waits 50 ms and drops shorter taps.
- The example is scheduled from a single monotonic start
  (`playExample()`), so late timers never add up.
- Sound comes from the existing `GameAudioManager` with an existing CC0
  sample (`assets/audio/games/ordo/pieceHit.mp3`, Kenney Impact Sounds,
  credited in docs/GAME_ASSETS.md).
  - No second audio engine is involved.
  - The global sound-effects setting is respected.
  - A playing komuz track is paused before the example.
- Backgrounding the app or leaving for another screen cancels every pending
  note at once and pauses the round. "Restart round" starts again from the
  example, and an interrupted attempt is never scored.
- Unmounting the screen also disposes the audio player.
- Switching accounts drops the session without saving it.

## Results

Each owner has a best score and session count per difficulty. These results
are separate from official game records, progress, achievements and streaks.

## Accessibility

- The difficulty choice is a radio group, and sound is a switch.
- The pad is a single large button (240 pt, 280 pt in child mode) with a
  hint.
- Status and results are announced, and per-note feedback is written out as
  text (✓ ~ ✕ – marks plus words, never colour alone).
- With Reduce Motion on, the lights still change colour but don't scale.

## Device checks: PENDING (not performed)

- [ ] iOS and Android: measure the latency from audio output to the
  speaker, from a touch to `onPressIn`, and with Bluetooth headphones. Check
  that a steady player still gets "on time" at 100 BPM. If not, retune
  `ON_TIME_BEATS` / `CLOSE_BEATS`.
- [ ] The example's sound and lights match by ear and eye at every level.
- [ ] Silent switch (iOS) and Do Not Disturb: the example still shows as
  lights.
- [ ] Background the app mid-example: the sound stops at once and the round
  is paused.
- [ ] Phone call mid-round: the same as backgrounding.
- [ ] VoiceOver / TalkBack: the pad can be activated and the results are read
  out. The largest text size keeps the pad on screen.
