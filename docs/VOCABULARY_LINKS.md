# Contextual vocabulary links

This extends the EXISTING inline glossary (`InlineGlossary.tsx`): dotted,
tappable terms in article sections that open a quick sheet. There is no
separate vocabulary system.

## The reviewed mapping (`inline/vocabularyLinks.ts`)

| Glossary entry | Article | Section key |
| --- | --- | --- |
| `tunduk` | `boz-uy-overview` | `objects_used` |
| `uuk` | `boz-uy-overview` | `objects_used` |
| `tunduk` | `boz-uy-karkas` | `objects_used` |
| `shyrdak` | `boz-uy-ichki-jasalga` | `objects_used` |
| `ala-kiyiz` | `boz-uy-ichki-jasalga` | `objects_used` |

- Each pair is checked against the seeded article text, through the same
  matcher the article uses (`segmentText`).
- `eer` in the interior's `cultural_meaning` was proposed but removed: it
  appears only inside a longer word, so the inline glossary doesn't link it
  there. The integrity test caught this.
- Articles are linked to themselves never: the existing self-exclusion
  applies.

## The sheet for a mapped term

The existing parts stay as they are: the term, the existing definition
(the glossary entry's source field) and "From: <article>".

Added:
- **Example from this article:** the sentence of this very section that
  contains the tapped word, quoted as written (KG authored text or its
  reviewed translation), with "Quoted from this article, section …". It is
  never a written-for-the-app sentence.
- **Pronunciation:** only a verified recording (`contentAudio`, key
  `glossary:<id>`). **None exist yet**, so the sheet says "No verified
  recording of this term yet". Device speech is not presented as
  pronunciation.
- **Add to my review:** the existing Glossary study queue
  (`answer(owner, id, 'review_again')`, as Listen & Repeat does). It is per
  owner, and its records hold ids and counts only. The button waits until
  the study store has loaded (an earlier write would replace the saved
  queue) and then shows "In my review list".

Terms in unmapped sections keep the plain sheet. The article text is never
changed. The sheet is a modal over the article, so closing it leaves the
reading position and section exactly where they were (the e2e measures
the term's position before and after). "Open Glossary" navigates, and Back
returns to the article.

## Tests

- `inline/vocabulary.test.ts`:
  - mapping integrity: entry, article, stable key, term linked there by the
    real matcher;
  - only mapped triples get the panel;
  - an entry with a missing source isn't linked;
  - examples are real sentences from the section;
  - no verified audio;
  - tap -> example + no-audio -> Add to my review (`needsReview`); an
    unmapped section gets the plain sheet.
- `e2e/tests/vocabulary.spec.ts` (KG, with the real "objects used" text):
  tap Түндүк -> example -> no audio -> save -> stored in the study queue ->
  close -> same position -> listed in Glossary study.

## Needed later

Verified recordings of the mapped terms, added as `glossary:<id>` keys
with their source.
