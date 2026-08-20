# Ордо (Ordo) — Rules

Kyrgyz team throwing/strategy game played with chuko (sheep-ankle bones/alchiks) around
a central "khan" piece. "Ордо" = khan's court/headquarters; the game simulates a
military siege of the khan's stronghold.

Status: **core rules verified from a Kyrgyz national-sport source**; team-size and
exact piece-count figures have small inconsistencies between sources — flagged below.

## Field

- Two concentric circles drawn on flat ground.
- **Adults**: inner circle radius 6 m (⌀ 12 m); **adolescents**: inner circle radius
  5 m (⌀ 10 m).
- An additional **1 m outer ring** surrounds the inner circle in both cases (giving the
  ⌀14 m figure some other sources quote for the adult field as the full outer
  boundary).

Source: [kabar.kg (archive) — Правила игры «Ордо»](https://ru.archive.kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-ordo/)

## Pieces

- Regular pieces are **chuko** (полированные альчики — polished sheep ankle-bones).
- The **khan** piece sits at the center, surrounded by the other pieces forming a
  cluster ("fortress"). It's made from an old coin or thin tin (i.e. visually/physically
  distinct from bone chuko) and **counts as 2 regular pieces** when scoring.
- Source text gives **5 chuko per player**, with a stated total of "68 alchiks... [68]
  чтобы Хан засчитывался за два альчика, всего 70 алчиков" — **the source's own
  arithmetic is inconsistent (68 vs 70)** and doesn't cleanly resolve against "5 per
  player" for a stated 7-or-8-player squad. Treat the *exact* total piece count as
  **UNVERIFIED** until cross-checked against a second primary source (e.g. the
  Kyrgyzstan national sports federation ruleset, referenced as existing in Kyrgyz,
  Russian, Turkish and English but not directly retrieved in this pass).

Source: [kabar.kg (archive) — Правила игры «Ордо»](https://ru.archive.kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-ordo/)

## Teams

- One Kyrgyz source states **7 players + 1 coach-player = 8** per team roster.
- A separate (English-language, World Nomad Games context) source states **10
  participants: 7 players, 1 substitute, 1 coach, 1 team leader** — this looks like a
  fuller *tournament delegation* breakdown (adding a non-playing team leader and an
  explicit substitute slot) rather than a contradiction of the 7-active-players figure.
  Both agree on **7 active players per team**; flag the surrounding roster/substitute
  detail as secondary and unconfirmed which figure is the strict "rules" answer vs.
  tournament-administration detail.

Sources: [kabar.kg (archive)](https://ru.archive.kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-ordo/), [The Times of Central Asia — The Rules of the Steppe](https://timesca.com/the-rules-of-the-steppe-countdown-to-the-2024-world-nomad-games/)

## Play

- Two teams take turns throwing chuko from outside the circle, trying to knock the
  opposing team's pieces (and eventually the khan) out of the circle/fortress.
- **The khan cannot be targeted first**: a team must knock out **3 regular pieces**
  before it is allowed to throw at the khan. When throwing specifically at the khan,
  the throwing distance/position is restricted to **one step** (closer range) — exact
  mechanical definition of "one step" not further specified in sources found; flag as
  **UNVERIFIED** pending a diagram/primary rulebook.

Source: [search-synthesized, ky.wikipedia.org / azattyk.org via search result]

## Scoring / win condition

- Capturing the khan is the decisive event: the team that knocks out the khan is
  awarded the khan **plus 3 additional pieces**; the opposing team receives **2
  pieces** (as a partial consolation/scoring adjustment).
- Exact procedure for how a full match's score is tallied beyond the khan-capture bonus
  (e.g. best-of-N rounds, total pieces cleared as tiebreaker) is **UNVERIFIED** — not
  found in this pass.

Source: [kabar.kg (archive) — Правила игры «Ордо»](https://ru.archive.kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-ordo/)

## Duration (competitive format)

- Adults: 2 hours. Adolescents: 1.5 hours. (Competition clock rule, not core engine
  logic — implement as configurable, not hard-coded.)

Source: [kabar.kg (archive) — Правила игры «Ордо»](https://ru.archive.kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-ordo/)

## Note on a primary rulebook PDF

An official-looking PDF (`worldnomadgames.org/.../Ordo-rules-en.pdf`) exists but
returned HTTP 403 (blocked) when fetched in this pass. **Before finalizing this
game's engine**, retry fetching that PDF (or ask a reviewer to supply it) — it is
likely the single best primary source and could resolve the piece-count and
scoring-detail gaps flagged above.
