# Home shortcuts

Home's "Your shortcuts" row (it replaced the fixed "More in OYNO" row) shows up to **four** pinned destinations. Users edit them at `/settings/home-shortcuts`, reached through **Edit** in the row.

## Choosing shortcuts

- **Source.** Shortcuts can only come from the activity chooser's validated catalogue (`ACTIVITY_CATALOG`; every route is checked by tests).
- **Labels.** They are the catalogue's own titles, never a record's contents.
- **Default layout.** One per interest, in the chooser's order: Today's Daily OYNO, Jaa Atuu, Oymo Creator, Komuz Listening Room.
- **Editing.** Add (while fewer than 4 are pinned), remove, and **move up / move down** with buttons. The buttons work for touch, keyboards and screen readers, each has a label such as "Move Culture Duel up", and every change is announced.
- **Reset shortcuts.** It asks for confirmation ("Your shortcuts go back to the default four. Nothing else changes."), then removes the owner's entry, so the default layout applies again.

## Storage

- **Where.** `oyno.homeShortcuts.v1` holds `{ [owner]: { pins: string[] } }`, on this device, per owner (guest or the account id). Switching accounts shows that owner's pins, or the default.
- **Independent of learning progress.** No progress reset, sync or backup reads or writes this key (tested).
- **Write-first, serialized.** A change is computed from the latest state, written, then shown. If the write fails, the shortcuts stay as they were and the editor says "Couldn't save. Your shortcuts are unchanged".
- **Unreadable storage.** It is an error state that blocks writes, so the stored value is never overwritten. Home and the editor both offer **Try again**.
- **Removed or unknown destinations.** An id from a retired activity or a newer app version is kept in storage untouched but never shown. Home says "1 shortcut is no longer available", and the editor offers "Remove unavailable shortcuts".
- **Offline.** A shortcut whose screen can't open with data on the device is shown as unavailable ("Needs an internet connection"), not hidden.
- **While loading,** Home shows four placeholder tiles in the same grid, not a spinner.

## Tests

- **Unit:** `src/features/home/shortcuts/shortcuts.test.ts` covers:
  - the default layout and that every catalogue route exists;
  - add, remove, move, reset and the limit of four;
  - unknown ids kept, reported and removable;
  - offline availability;
  - per-owner storage, and that reordering survives a reload;
  - a failed write changes nothing;
  - unreadable storage blocks writes, and Retry reads it again;
  - labels come only from the catalogue, the store is independent of progress, and strings exist in KG, RU and EN.
- **E2E:** `e2e/tests/home-shortcuts.spec.ts` covers:
  - every default shortcut opens its destination;
  - remove, add and reorder; Home follows, and the order survives a reload;
  - Reset: Cancel keeps the shortcuts, Confirm restores the default;
  - another owner's pins are untouched, and an unavailable id is reported and removable (RU);
  - a failed write (localStorage throws) leaves the shortcuts unchanged;
  - unreadable storage: Home still works, and Retry recovers (KG);
  - axe on the editor.
- **Screenshot** reviewed: `e2e/.results/shortcuts-editor.png`.

## Device checks: PENDING

- VoiceOver and TalkBack announcements for move, add and remove.
- Persistence across an app restart on iOS and Android.
