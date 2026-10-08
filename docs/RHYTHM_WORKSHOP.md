# Rhythm Workshop (2026-10-08)

- **Route:** `/culture/komuz/workshop`. The entry is "Rhythm Workshop" on
  Repeat the Rhythm's start screen.
- **Code:** `src/features/culture/komuz/rhythm/workshop/`
  (`workshopModel.ts` is pure).

## What it reuses

- **Playback:** Repeat the Rhythm's `playExample` scheduler (one monotonic
  start, cancellable) and `createRepeatAudio`, the existing
  `GameAudioManager` with the CC0 wooden tap.
  - No new audio engine and no microphone.
  - The global sound-effects setting is respected.
  - A playing komuz track is paused first.
- **Scoring:** Repeat the Rhythm's relative-timing evaluator, generalised to
  any onsets as `scoreOnsets`; `scoreTaps` now wraps it.
  - The same tolerances apply: on time at most 0.12 beat, close at most
    0.25.
  - The same double-tap rule (80 ms) and the same fit to the player's own
    tempo.
  - A slow and a fast performance of the same rhythm score the same.

## Composer

- **Grid:** 16 steps of half a beat (8 beats) in two rows of four beats.
  On-beat steps are outlined more strongly, and each step is a labelled
  checkbox: "Beat n, on the beat / half a beat after: sounds / silent".
- **Limits:** 2–12 notes, one sound, and tempo 70, 85 or 100 BPM. The
  rhythm starts on its first note, so it is at most 7.5 beats long.
  `validateComposition` rejects empty, single-note, over-long and tampered
  rhythms (duplicates, steps outside the grid, an unknown tempo), and only a
  valid rhythm can be handed over.
- **Controls:** Play, Stop and Clear, plus three authored examples (Walking,
  Hopping, Echo), labelled as practice exercises written for OYNO.
- **Labels:** the composer says "Your rhythm is your own practice exercise -
  it is not traditional komuz music."

## Handoff and player

1. **"Pass the phone":** from here the rhythm is LOCKED and HIDDEN.
   `visibleSteps()` returns nothing until the player has tried and taps
   "Show the rhythm". No grid is rendered in the handoff, listen or tapping
   phases (unit and e2e tests).
2. **Listen:** a single beat light flashes on each note. This visual cue
   doesn't draw the grid. With Reduce Motion on it changes colour but
   doesn't scale.
3. **Tap back** on the large pad. Press-in has no delay on web. Silence or
   "Done" ends the attempt, and "Hear it again" restarts the listening.
4. **Feedback:** "Timing similarity: x of y points", per-note grades and a
   tempo note, with the line "This compares the timing of your taps with
   the rhythm… It isn't a judgement of musical skill."
5. Then: "Show the rhythm", "Try again" (back to the hidden handoff) or
   "Back to the composer".

## When an attempt ends (2026-10-08)

- Tapping a note for every note, or **Done**, ends the attempt at once.
- Otherwise the wait for the next tap follows the rhythm itself
  (`attemptTimeoutMs`): the gap to the next note at the player's OWN pace so
  far (never faster than the demonstration, at most twice as slow) × 1.75,
  plus 1.5 s.
- The wait is never shorter than 2 s and never longer than the 20 s
  abandoned-attempt bound.
- This means every accepted composition fits. For example, steps [0, 15] at
  70 BPM have a 6.43 s rest, and the wait is about 12.8 s; the old fixed
  timer was about 2.1 s.
- Scoring is unchanged: it is still relative timing.
- Done, replay, backgrounding and leaving all clear the pending timer
  (screen-level fake-timer tests).

## Lifecycle and privacy

- Stop, leaving the screen (focus lost), backgrounding (AppState) and
  unmounting each cancel every scheduled note at once. Unmounting also
  disposes the player. All of this is tested through the real screen.
- A backgrounded attempt is dropped: the player restarts from the hidden
  handoff, and the screen says why.
- There is no recording, no backend, no sharing and no stored results.
  The composition lives only in the screen.
- Works offline; KG/RU/EN.

## Tests

- **Unit (`workshop.test.ts`):**
  - composition limits and validation;
  - examples, onsets and timing;
  - handoff privacy across every phase;
  - scoring: full marks, tempo invariance, double taps, taps after the end,
    interruption;
  - the real screen: Stop, focus loss, background and unmount all silence
    playback, and no grid is rendered after the handover;
  - texts.
- **e2e (`rhythm-workshop.spec.ts`):**
  - the full journey: validation messages, an example, Play/Stop, handover
    with no grid, listening, tapping, feedback, reveal, try again;
  - offline (KG); axe (RU) on composer, handoff and player.

## Physical-device audio checks: PENDING (not performed)

- [ ] Output latency of the tap sample on iOS and Android, with the
  speaker, wired headphones and Bluetooth headphones. Does a steady player
  still get "on time" at 100 BPM?
- [ ] Touch-to-`onPressIn` latency on a low-end Android phone.
- [ ] The scheduler's evenness at 100 BPM, with half-beat steps
  (300 ms apart).
- [ ] iOS silent switch: the light alone still carries the rhythm.
- [ ] Locking the phone or taking a call mid-rhythm: sound stops at once,
  and the attempt restarts from the handover.
- [ ] VoiceOver / TalkBack: the grid steps and the pad are reachable, and
  the score is announced.
