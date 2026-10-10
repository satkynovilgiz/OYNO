# Mini Museum: curator narration

Optional, per exhibit, in exhibition editing ("Narration: none / recorded /
written" under each exhibit). Visitors see it in Present and in the guided
tour, labelled **Curator's narration**.

## What can be recorded where

| Platform | Recording | Written narration |
| --- | --- | --- |
| Web (browser with a microphone) | Yes, up to 60 s | Yes |
| iOS / Android - current builds | **No.** The builds have no microphone permission (`MICROPHONE_NATIVE_BUILD_READY = false`, see `glossary/practice/pronunciation.ts`); the editor says so | Yes |
| Browser without recording support | No (explained) | Yes |

Enabling native recording requires the app.json microphone permission text,
a runtimeVersion bump and a new native build. An OTA update cannot add a
permission. The native storage code (`nativeNarrationStore`) is written but
has **not been run on a device**.

## Recording lifecycle (`narrationModel.recorderReducer`)

1. **Record a narration** shows an explanation first: it will ask for the
   microphone, the 60 s limit, that the recording stays on this device, and
   that nothing is saved until "Save recording". The OS/browser prompt
   appears only after "Allow microphone and record".
2. **Denied** shows an explanation. Editing stays fully usable and the
   written narration field is right there. Nothing is recorded.
3. **Recording** shows elapsed / 60 s and Stop. It stops by itself at 60 s
   and when the app is backgrounded.
4. **Review** offers Listen, Save recording or Discard. The take is a
   temporary file (a web blob URL or the native recorder's cache file).
   Discard deletes it, and so does leaving editing or switching account.
5. **Save** copies the take into owner-bound storage. Only after that copy
   succeeds does the exhibit point to the new recording, and only then is the
   previous recording deleted. If the save fails, nothing changes: the
   previous recording stays, and the take is deleted.

Deleting a recording asks first. The written words are kept.

## Written words / transcript

A text field typed by the curator: "Written narration" when there is no
recording, "Transcript of your recording" when there is. Nothing is
transcribed automatically, and the UI says so.

## Storage and accounts

- The exhibition stores `{ audioId, durationMs, text }` per exhibit.
- The audio lives in `services/museum/narrationAudio.ts`: IndexedDB
  `oyno-narrations` on web, or `<documents>/narrations/<owner>/` on native.
  Every read checks the owner, so another account gets nothing, even with the
  id.
- Guest -> signed in: the guest's exhibitions join the account, and their
  recordings are re-bound to the account.
- Removing an exhibit, deleting the collection, or forgetting an owner on
  this device deletes the recordings concerned. Opening the museum also
  sweeps that owner's unreferenced recordings (for example after a failed
  delete).

## Playback coordination (`services/museum/narrationPlayer.ts`)

- Only one narration plays at a time.
- Playing one stops the audio guide, komuz music and speech (the same rule as
  Listen & Repeat).
- The audio guide or komuz starting stops the narration.
- It also stops on the next exhibit, when leaving Present or the tour, when
  leaving the museum, and on an account switch.

## Backup / export (actual behaviour)

- Narrations (audio and text), like the rest of the Mini Museum
  presentation, are **not** in the learning-data export
  (`learningExport.ts` exports collections, not exhibitions), and are not
  synced.
- They can't be restored from a backup. Clearing site data (web) or
  uninstalling (native) removes them.
- The editor states this under every narration.

## Tests

- `museum/narration.test.ts`:
  - record normalisation;
  - replacement and release;
  - lifecycle transitions (denied, review, save, save failed);
  - owner-bound storage and reassignment;
  - the sweep;
  - store deletes on exhibit, collection and owner removal;
  - guest adoption;
  - coordination (guide or komuz stop the narration, one at a time, another
    account can't play);
  - editor: denied leaves written narration; no recording support; discard
    and leave delete the temp take; a failed replacement keeps the old one
    and a successful one deletes it only afterwards; delete confirms.
- `museum/narrationScreen.test.ts`: the real screen, covering visitor
  label and transcript, finishing stops, an account switch stops and hides,
  unmount stops, and written-only editing.
- `e2e/tests/museum-narration.spec.ts` (Chromium fake microphone):
  - record, preview, save;
  - transcript;
  - a discarded replacement;
  - a saved replacement (the old one is deleted);
  - visit and play;
  - next exhibit stops;
  - reload, still plays;
  - removing the exhibit deletes the recording;
  - axe.
- `e2e/tests/museum-narration-denied.spec.ts` (no microphone, RU):
  denied, written narration shown to visitors, nothing stored.

## Needs a physical device (PENDING)

- Native recording, the permission prompt, file copy, playback from the
  documents directory and deletion. These need a build with the microphone
  permission; current builds show written narration only.
- Real microphone quality and Safari/iOS web recording (the e2e uses
  Chromium's fake device).
- Audio-session behaviour: narration vs other apps' audio, silent switch,
  Bluetooth, interruptions such as a call during recording.
- VoiceOver/TalkBack with the recording controls and the live elapsed time.
