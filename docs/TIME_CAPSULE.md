# Culture Time Capsule

Profile -> **Time capsules** (`/profile/capsules`). In the Oymo Creator,
**Put in a time capsule** starts a new capsule with a copy of the current
design.

## Flow

1. **Draft:** a title, a message, up to 3 culture articles (searched in the
   app's own localized article list), and one Oymo design snapshot.
   Save the draft at any time.
2. **Opening date:** an accessible control. It shows the date in words,
   with buttons for one day / month / year earlier or later and quick
   choices (a week, a month, 6 months, a year). The range is tomorrow
   to +50 years.
3. **Seal:** this needs a title, a message and a valid date. After sealing,
   nothing can be edited and the message is not shown.
4. **Open:** when the date has come; or **Open early…** with an explicit
   confirmation, recorded as "opened early".
5. **Reflect:** a new reflection. The original message, articles and design
   stay exactly as sealed.
6. **Delete:** at any stage, after confirmation.

## What "sealed" means

It is an app experience, not encryption. The screens say so: the message is
hidden on screen until the date, but it is stored on this device like other
app data and can be read from device storage. Nothing is scheduled; there
are no notifications or background work. The app checks the date when you
look.

## The date rule (`capsuleModel.isDue`)

A capsule is due when **today's local date** is on or after the opening
date.
- "Today" is `localDateKey()`: YYYY-MM-DD from the device clock and time zone.
- So it opens from local midnight at the start of the opening day.
- Changing the device time zone or clock moves that moment with it.
- Month and year steps keep the day, or use the month's last day
  (31 Jan + 1 month = 28/29 Feb).

## Attachments

- **Articles:** stored as type, id and the title at the time.
- **Design:** a deep copy of the layers, background and symmetry
  (`snapshotDesign`), so later edits to the design don't change it.
  The Creator hand-over is in memory, bound to the owner, and taken once.
- **Custom motifs in the design** (review fix, 2026-10-14). Before the fix,
  `normalizeDesign` rebuilt each layer without its embedded `custom` geometry,
  so a capsule saved with a user-created motif reopened as the "can't show"
  placeholder. The snapshot also shared the nested primitives with the
  Creator. Both now go through `carryEmbedded` (customMotifModel.ts):
  - a valid version-1 embed is re-validated and deep-copied;
  - an embed this version can't read (a newer `v`, damaged primitives) is
    kept as an independent copy of at most 8,000 JSON characters. The layer
    still renders the labelled placeholder and is never dropped or swapped
    for another shape;
  - built-in layers never carry a `custom` field and normalize exactly as
    before.

## Storage (`useCapsuleStore`)

- `oyno.timeCapsules.v1`: `{ <owner>: Capsule[] }`, at most 50 per owner.
  Every read and write uses the current owner; switching account hides the
  previous owner's capsules.
- **Explicit writes:** a save writes to storage first and only then
  updates the screen. On failure, nothing changes: the draft stays on
  screen with "Couldn't save … try again" and Retry.
- **Loading:** a read failure or unreadable data shows an error with Retry,
  never an empty list. Writes are refused until loading succeeds, so the
  stored data is not overwritten.

## Backup / export (actual behaviour)

- Capsules are **not** synced and **not** in the learning-data export
  (`learningExport.ts` has no capsule domain), so a backup file doesn't
  contain them.
- Clearing app or site data, or uninstalling, removes them. The list screen
  states this.

## Tests

- `capsules/capsule.test.ts`:
  - **Date rule:** the day before vs. on the date; local midnight with a
    faked device clock; month ends and leap years; the tomorrow and
    +50-year limits; impossible dates.
  - **Lifecycle:** what is required to seal; no edits after sealing; early
    opening needs the flag and is recorded; a reflection keeps the message;
    at most 3 articles.
  - **Snapshot:** independent of the source design; owner-bound, taken once.
  - **Custom motifs:** Creator -> capsule -> save -> restart keeps the geometry
    beside a built-in layer; nested primitives are deep-copied by the snapshot
    and by normalization; newer or damaged embeds are kept; oversized and
    stray embeds are bounded.
  - **Tampered storage** is bounded.
  - **Store:** per owner; restart; a failed write changes nothing;
    unreadable data is an error and is not saved over.
  - **Screens:** a failed save keeps the draft and Retry saves it; a sealed
    capsule hides the message and early opening needs confirmation, then
    reflect; an account switch hides capsules; a missing article keeps its
    title and shows "Unavailable".
- `e2e/tests/time-capsule.spec.ts`, using Playwright's clock:
  - at 320 and 412 px: Creator design -> capsule -> article -> a week ->
    seal -> 23:59 the day before is still sealed -> 00:01 on the date is
    ready -> open -> reflection survives a reload;
  - KG: early opening with confirm and cancel, then delete with confirm.
- `e2e/tests/capsule-custom-motif.spec.ts`: a saved custom motif -> Place ->
  Creator -> capsule -> save draft -> reload (stored geometry equals the
  motif; no placeholder drawn), and a seeded version-2 embed shows the
  placeholder and survives saving the draft again.

## Platform limitations / pending

- Date controls are buttons, not the platform date picker (none is in the
  project). VoiceOver/TalkBack reading of the live date is unverified on a
  device.
- On native, AsyncStorage write-failure handling is tested in Jest only.
