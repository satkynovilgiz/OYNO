# Source Lens

- **Entry:** "About this information" under every article section.
- **Code:**
  - `src/features/culture/sources/sourceLensModel.ts`
  - `SourceLens.tsx`
- **Reused:**
  - the existing `explorerSources` and `describeSource` (http/https only, curated publisher
    names);
  - the review-state copy (`sources.status.*`);
  - connection evidence (`connectionsData.ts`);
  - the Reading Companion bookmark note and Highlights notes.

## What it shows: only stored metadata

1. **OYNO's article text:** the section is the editors' own article text. It shows the article's
   stored review state and the authored-text date (`content_updated_at`) when one is stored.
2. **Recorded sources:** the article's own `sources`. OYNO stores **no source-to-section
   mapping**, and the Lens says so; it never claims a source supports this particular section.
   - Non-web entries are listed as "not a working web link" and are never opened.
   - With no openable source the Lens says: "Source details are not available. That doesn't mean
     the information is wrong."
3. **Original words quoted from this section:** exact excerpts of this article and this section
   that OYNO connections quote as evidence. They are shown as quotations, apart from editorial
   text.
4. **Contributor quotations:** none are stored in OYNO's content, and the Lens says "none are
   recorded".
5. **Your notes:** the reader's bookmark and highlight notes for this section, labelled "your
   notes, not a source". They never count as attribution.

Nothing else is shown: no invented authors, dates, references or confidence scores.

## Links and return

- **Opening a source** opens exactly the recorded URL (http/https only, nothing appended: no
  notes, no account data) in the system browser. A failure is reported in the Lens.
- **"All sources for this article"** opens the existing Source Explorer.
- **Returning:** leaving with a Lens open stores the article's scroll offset in memory
  (`keepLensReturn`). It is restored once, when the content is laid out again, with the same
  Lens still open (`openLensFor`), so the reader lands on the same section. On web, the article
  screen is re-created on back navigation, so this can't rely on the screen staying mounted.
  Ordinary visits are not affected.
- **Offline:** everything comes from the cached article row and bundled connection data.

## Content needing editorial source enrichment

Counted from the seeded migrations (the content source of truth in this repo):
- **235 culture items** in total.
- **Review state:** 0 verified, 65 partially
  verified, 165 unverified, and 5 with no level set in the
  seed.
- **137** items record at least one web source. **98 record none**, so their
  Lens shows the honest fallback.
- **No item** has per-section source mapping, and no item has contributor quotations.

Editorial work needed:
1. Add sources to the items listed below.
2. Decide whether OYNO should store section-level attribution. That needs a schema change and
   editorial review.
3. Record contributor quotations with permission, if any are planned.

Items with no recorded web source:

- `boz-uy-overview`
- `id`
- `komuz-melodies`
- `oymo-balyk-oyuu`
- `trad-fest-01`
- `trad-fest-02`
- `trad-fest-03`
- `trad-fest-04`
- `trad-fest-05`
- `trad-fest-06`
- `trad-fest-07`
- `trad-fest-08`
- `trad-fest-09`
- `trad-fest-10`
- `trad-fest-11`
- `trad-fest-12`
- `trad-funeral-01`
- `trad-funeral-02`
- `trad-funeral-03`
- `trad-funeral-04`
- `trad-funeral-05`
- `trad-funeral-06`
- `trad-funeral-07`
- `trad-funeral-08`
- `trad-funeral-09`
- `trad-funeral-10`
- `trad-funeral-11`
- `trad-funeral-12`
- `trad-funeral-13`
- `trad-funeral-14`
- `trad-funeral-15`
- `trad-funeral-16`
- `trad-funeral-17`
- `trad-funeral-18`
- `trad-funeral-19`
- `trad-hosp-01`
- `trad-hosp-02`
- `trad-hosp-03`
- `trad-hosp-04`
- `trad-hosp-05`
- `trad-hosp-06`
- `trad-hosp-07`
- `trad-hosp-08`
- `trad-hosp-09`
- `trad-hosp-10`
- `trad-hosp-11`
- `trad-hosp-12`
- `trad-hosp-13`
- `trad-hosp-14`
- `trad-hosp-15`
- `trad-hosp-16`
- `trad-hosp-17`
- `trad-hosp-18`
- `trad-hosp-19`
- `trad-nomad-01`
- `trad-nomad-02`
- `trad-nomad-03`
- `trad-nomad-04`
- `trad-nomad-05`
- `trad-nomad-06`
- `trad-nomad-07`
- `trad-nomad-08`
- `trad-nomad-09`
- `trad-nomad-10`
- `trad-nomad-11`
- `trad-nomad-12`
- `trad-nomad-13`
- `trad-nomad-14`
- `trad-nomad-15`
- `trad-nomad-16`
- `trad-nomad-17`
- `trad-nomad-18`
- `trad-nomad-19`
- `trad-nomad-20`
- `trad-wedding-01`
- `trad-wedding-02`
- `trad-wedding-03`
- `trad-wedding-04`
- `trad-wedding-05`
- `trad-wedding-06`
- `trad-wedding-07`
- `trad-wedding-08`
- `trad-wedding-09`
- `trad-wedding-10`
- `trad-wedding-11`
- `trad-wedding-12`
- `trad-wedding-13`
- `trad-wedding-14`
- `trad-wedding-15`
- `trad-wedding-16`
- `trad-wedding-17`
- `trad-wedding-18`
- `trad-wedding-19`
- `trad-wedding-20`
- `баш кийимдер`
- `бут кийимдер`
- `зер буюмдар`
- `сырткы кийимдер`

## Tests

- `src/features/culture/sources/sourceLens.test.ts` covers:
  - mapping from stored fields;
  - exact excerpts matched by article and section;
  - missing and invalid fields (no upgrade of review state, bad dates dropped);
  - non-web entries never linked;
  - links exactly as recorded;
  - personal notes kept apart and never counted as attribution;
  - kept-open and return memory.
- `e2e/tests/source-lens.spec.ts`:
  - article section → Lens → sources, an unavailable entry and a personal note kept apart → open
    a source (exact URL, popup) → Source Explorer → back, with the same position and the Lens
    still open;
  - no-sources fallback (RU).

Device checks: PENDING. This includes the external browser hand-off and returning to the app on
iOS and Android.
