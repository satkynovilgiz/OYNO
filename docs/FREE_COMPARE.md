# Compare any two culture items (2026-10-08)

- **Route:** `/culture/compare/pick?left=<id>&right=<id>`.
- **Entries:**
  - "Compare with another item" on every culture article, which opens the
    picker with that article as the first item;
  - "Choose your own pair" on the curated Compare list.
- **Code:** `src/features/culture/compare/freeCompare.ts` (pure) and
  `FreeCompareScreen.tsx`.
- The curated pairs (`CULTURE_COMPARISONS`, `/culture/compare/[id]`) are
  unchanged.

## Rules

- **Fields:** only fields of the content model (`CultureItemRow`):
  - origin
  - history
  - cultural meaning
  - when used
  - ingredients
  - traditional method
  - who participates
  - objects used
  - regional notes
  - modern status
  - fun facts

  Each field uses its existing article label.
- **Text:** each side shows its own authored text, unchanged.
  - A side with no text for a field reads **"Not provided"**.
  - Fields neither article has are left out and listed once ("Neither
    article covers: …").
  - No difference, summary or ranking is ever written.
- **Connections:** shown only when `CULTURE_CONNECTIONS` explicitly links
  this exact pair (either direction).
  - Read from the first item, with the reverse label only where the data
    allows it.
  - Each is quoted with its source article and section. Otherwise:
    "OYNO's curated connections don't link these two."
- **Sources:** each item's existing "Sources & notes" plus "Open full
  story".
- **Selection:**
  - Choose or replace either side from the loaded catalogue, with a search.
  - Choosing the item already on the other side swaps them, so a pair is
    never the same item twice. "Swap sides" is also available.
- **State:** the pair lives in the route (`router.setParams`). Opening a
  source and coming back keeps it. Nothing is stored, there is no backend,
  and nothing counts as progress.
- **Offline:** cached items compare offline, including swapping and
  replacing. With no catalogue on the device, the standard offline screen
  with Retry appears. An item that isn't in the catalogue says "This article
  isn't available…" instead of comparing.
- **Layout:**
  - Phones: paired sections, the first item then the second for each field.
  - 768 pt and wider: two columns.
  - Screen readers hear "<title> - <field>: <text or Not provided>".
  - Large text in child mode.
- **Languages:** KG/RU/EN. A Kyrgyz-only article shows the existing note
  with its title.

## Tests

- **Unit (`freeCompare.test.ts`):**
  - missing fields become Not provided;
  - fields neither has;
  - whitespace is not text;
  - field labels exist in every language;
  - connections only for linked pairs, with reverse reading;
  - choose, replace, swap, route and search;
  - the screen: Not provided and the link, a missing item, replacing
    updates the route, offline with and without a cache.
- **e2e (`free-compare.spec.ts`):**
  - from an article: pick → compare → replace → swap → open source →
    return to the same pair;
  - unavailable article;
  - offline swap and replace;
  - layout at 320 px (stacked) and 1024 px (columns) with no overflow;
  - RU; axe.

## Device checks: PENDING

- [ ] VoiceOver / TalkBack read each side with its item title, and the
  picker's search is reachable.
