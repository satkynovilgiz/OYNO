# Export cards

Every image OYNO exports goes through **one path**: `useShareCard().share(content)` opens `SharePreviewSheet`, which renders `<ShareCard {...card} />`. Share and Save capture that same card off-screen at 1080 px wide (3×). The preview is therefore the export, and the `card` object passed to the capture is the one previewed, including the chosen picture and style.

## Layout primitives (`src/components/share/ShareCard.tsx`)

| Primitive | Used by |
| --- | --- |
| `CardAttribution`: oymo mark, the content's label, OYNO wordmark | journal, creation, summary |
| `CardText`: text placed by the one fit rule | every title, subtitle, excerpt, summary figure and featured item |
| `CardArtwork`: the artwork scaled whole into a frame, never cropped | creation |
| `Rule`: gold oymo rule | story, score, badge, summary |
| `ShortenedNote`: "Shortened to fit the card" | any card whose text the fit rule had to cut |

Each card type keeps its own layout:

- **story / score:** a photograph with the title over it, or a big real figure;
- **journal:** a framed picture on paper;
- **badge:** the whole medal on forest green;
- **creation:** the artwork whole;
- **summary:** real figures;
- **postcard:** the person's own composition (Oymo postcard, design portfolio).

The postcard, portfolio and Mini Museum story cards (`PostcardView`, `PortfolioCardView`, `StoryCardView`) already had their own fit rules, fixed card fonts and "shortened" notes; they are composed views and keep them.

## Fitting long text (`cardFit.ts`)

- **One deterministic rule** shared by the preview and the export. It replaces `adjustsFontSizeToFit`, which behaves differently on iOS, Android and web.
- **How it works:** try each size of the role, largest first. If nothing fits in the role's lines, it uses the smallest size, cuts at a word with "…", and the card shows **"Shortened to fit the card"**.
- **Width estimate:** 0.62 em per glyph. It was measured on the exported KG card (0.56 under-counted a line and let the renderer add its own ellipsis).
- **Fixed card text:** card text ignores system font scaling (`allowFontScaling={false}`), because the card has a fixed logical size.

## Approved fields only (`cardContent.ts`)

Each card type has an explicit list of approved fields. `approvedContent()` is applied once when sharing starts, so the preview and the export get exactly the same filtered content.

| Card | Fields |
| --- | --- |
| story | title, label, subtitle, picture, tone, completed |
| score | title, label, subtitle, picture, tone, figure |
| journal | title, label, chosen picture, the one line typed for the card, linked content |
| badge | title, label, medal art, note |
| creation | title, label, artwork, style |
| summary | title, label, figure lines, featured titles, style |
| postcard | the composed view and its size |

Anything else a caller passes is dropped: account ids, recipes, notes, emails. Text that looks like a UUID, an email or a long number is refused even in an approved field. Journal cards never contain the private note (E2E).

## Styles

- **Three styles:** paper, forest and felt red, from the OYNO palette only. They are offered where the artwork or the figures are the subject (creation, summary). The choice is a radio group in the preview sheet and travels with the card to the export.
- **The preview sheet's picture choice** is now also real radios; the old chip used `aria-selected` on a button, which is not allowed.
- **Custom motifs** render in artwork exports through the same `LayerMotif` renderer as the canvas.
- **Creator export** now uses `OymoArtwork`: the design alone, without the canvas's symmetry guide lines (previously the guide lines were captured too).

## Failure recovery and cleanup

These are unchanged and still tested (`useShareCard.test.ts`):

- one export at a time;
- a failed capture or share keeps the preview open for an immediate retry;
- the previous temporary file is removed before a new export and after sharing.

## Tests

- **Unit:** `src/components/share/exportCards.test.ts` covers:
  - fitting: largest size, step down, then cut with a flag, using long KG, RU and EN titles in every title role;
  - determinism and word wrap;
  - approved fields per card type and refused private text;
  - the creation artwork kept;
  - one rendering path, no auto-shrink, every card text fixed, cleanup present;
  - styles, and KG, RU and EN strings.
- **E2E:** `e2e/tests/export-cards.spec.ts` covers:
  - a long journal title in KG, RU and EN: shortened with the visible note, inside the card's box, and without the private note;
  - a design card: artwork whole, three styles switching on the previewed card, axe passing.
- **Screenshots** reviewed: `e2e/.results/export-*.png`.

## Native export checks: PENDING (needs physical iOS and Android devices)

- The captured JPEG matches the preview for each card type and style.
- Long KG, RU and EN titles in the exported image match the preview line for line.
- A custom motif in an exported creation.
- Temporary-file cleanup after Share and after Save to Photos.
- Behaviour with large system text, which is ignored inside the card by design.
