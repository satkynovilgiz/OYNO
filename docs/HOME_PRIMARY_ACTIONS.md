# Home: Discover, Create, Continue

Home now opens with three primary actions, placed above the existing sections. Every section, route and customization that was there before still works.

| Action | What it is | Opens |
| --- | --- | --- |
| **Discover** | Dark-green tile with the Boz Üy camp photograph | `/culture` (the existing Culture hub) |
| **Create** | Terracotta tile with the oymo carving photograph | `/create`, a new hub that only groups existing screens |
| **Continue** | One card of real unfinished work, or an honest empty state | The work itself |

Both tiles use existing bundled artwork. They are static, so they render before any data loads.

## Continue: the rules (`src/features/home/primary/homePrimaryModel.ts`)

The first match wins, and everything is scoped to the current owner:

1. **Unsaved work.** These are the Recovery Center's own entries (in-memory editor drafts, plus journal drafts stored on the device).
   - One entry opens its editor; several entries open the Recovery Center.
   - The card names the kind of work (for example "Journal draft"). It never shows the record's text.
2. **Getting-started guide.** Shown when the person started the guide and hasn't finished it. The Home offer card now only offers the guide; once started, the guide continues from this card.
3. **Reading.** The Continue Reading article (most recent unfinished). It reopens at the last section when one was recorded.
4. **Journey.** Home's recommendation, but only when it is a real continuation: a trail, quest, collection or passport in progress. "Play again" is not unfinished work.

If nothing matches, Continue shows one of two states:

- **New**: "Nothing to continue yet". It appears only when there is no trace of use at all.
- **Returning**: "Nothing unfinished right now".

Two further rules:

- When the hero recommendation is a continuation, the hero hides it, so Home never shows two Continue cards.
- When offline, any screen that can't open with on-device data is skipped. Unsaved work then falls back to the Recovery Center, which is local.

## States

- **Loading.** While the local stores load, Continue shows a placeholder in the card's own shape, labelled "Checking for unfinished work". There is no spinner.
- **Failed loading.** If content fails to load, the article can't be resolved, so Continue shows the honest empty state. The Discover and Create tiles stay in place (covered by E2E).
- **New person.** The heading reads "Where to begin", followed by a one-line explanation, and the Discover tile carries a "Start here" badge.

## Secondary features

- **"More in OYNO"** is a short row of existing destinations: Games, World Map, Find something to do, and My OYNO Shelf.
- **Create hub (`/create`)** has three groups:
  - **Make something**: the activity chooser's validated create activities.
  - **Tools**: My motifs and Color Lab.
  - **Your work**: My OYNO Shelf.

## Accessibility and languages

- Each tile has one label that combines its title, description and the "Start here" badge.
- Headings are real headers, and the progress bar is announced as a percentage.
- Tiles use `flexBasis` and stack one per row on narrow screens or with long text. E2E checks 320 px with larger controls in KG, RU and EN for horizontal overflow and raw i18n keys.
- All copy exists in KG, RU and EN, including plurals.

## Tests

- Unit tests: `src/features/home/primary/homePrimary.test.ts`.
- E2E: `e2e/tests/home-primary.spec.ts`, plus the updated resume step in `first-use.spec.ts`.

## Device checks: PENDING

The following are still to be checked on a real phone:

- VoiceOver and TalkBack reading order of the tiles and the Continue card.
- iOS Dynamic Type at the largest sizes.
