# Чүкө (Chuko) — Rules

**Important framing before anything else**: "Чүкө" is not one fixed game — it is a
whole *family* of Kyrgyz games played with sheep/goat ankle-bones (astragali). Kyrgyz
sources cite **more than 80 named variants**. The product spec asks which traditional
variant is "most referenced" — see the two documented below; do not present either as
"the" single official Chuko game without that caveat surfaced in the UI/tutorial too
(e.g. "бул чүкөнүн бир түрү" — "this is one variant of chuko").

Status: **two variants documented from Kyrgyz sources**; several named variants
mentioned only by name, not by rule (flagged UNVERIFIED).

Sources: [ky.wikipedia.org — Чүкө оюндары](https://ky.wikipedia.org/wiki/%D0%A7%D2%AF%D0%BA%D3%A9_%D0%BE%D1%8E%D0%BD%D0%B4%D0%B0%D1%80%D1%8B), [super.kg — ЧҮКӨ](https://www.super.kg/article/show/26455), [super.kg — 80ден ашык түрү бар чүкө оюндары](https://www.super.kg/article/show/59404)

## Piece terminology

- "Чүкө" (chuko) = a sheep/goat ankle-bone (astragalus). Same bone is called "shagai"
  in Mongolian, "asyk"/"oshuk" in Kazakh/Tajik traditions — related but separately
  documented games; do not assume identical rules across those.
- When thrown, a chuko lands on one of (up to) five faces/positions: **чик, бөк, таа,
  алчы, оңко**. These position names recur across Chuko variants but their *scoring
  value* differs by variant (see below).

Source: [ky.wikipedia.org — Чүкө оюндары](https://ky.wikipedia.org/wiki/%D0%A7%D2%AF%D0%BA%D3%A9_%D0%BE%D1%8E%D0%BD%D0%B4%D0%B0%D1%80%D1%8B)

## Variant A — throw-and-collect (accuracy/collection game)

This is the variant described as the "basic rules" across multiple general sources —
the most-referenced simple version.

- Chukos are lined up in a row, or arranged in a circle.
- Players take turns throwing (from a distance of a few meters) at the lined-up
  chukos, trying to knock them out of the row/circle.
- A successful hit: the thrower **collects** the chuko(s) they knocked out.
- Play continues until no chukos remain in the row/circle; whoever collected the most
  wins.

Source: [search-synthesized from central-asia.guide and super.kg]

## Variant B — упай (points) scoring game

A distinct, explicitly points-based variant:

- Each thrown chuko lands on one of the five faces. Scoring:
  - **оңко → 3 points**
  - **алчы → 2 points**
  - **таа → 1 point**
  - **бөк or чик → 0 points, turn passes to the opponent**
- Source explicitly frames this points table as "one of the traditional variations,"
  not the only one — consistent with the many-variants framing above.

Source: [search-synthesized, citing ky.wikipedia.org "Упай" and super.kg]

**UNVERIFIED**: which face is more/less common to land on (bone-shape-dependent
probability), and whether a full match has a target score or fixed number of throws,
were not found in this pass.

## Other named variants (NOT rule-documented — do not implement without further research)

Kyrgyz sources name simplified children's versions **айлампа**, **үч таман**, and
**канталамай**, and a related game **"кан таламай"** (found as a standalone named
game on a Kyrgyz culture-center blog) — none of these had their actual play procedure
retrieved in this pass. **Mark all of these UNVERIFIED and do not invent rules for
them.** If the product wants multiple named Chuko sub-games (matching the ~80-variant
reality), each one needs its own dedicated research pass before implementation.

A separate list — **ура атуу, топ бузуу, кыңай атуу, кадамак кадоо, тоорумай, чалмай
атуу** — appeared in a search result in the same breath as Ordo, and was initially
guessed here as Ordo-specific throwing techniques. **Correction**: a dedicated search
for Жаа атуу (archery) turned up the same list (see `games/zhaaAtuu/RULES.md`), and
since most of these terms contain "атуу" (= "to shoot"), they are far more likely
**archery shooting techniques** that got cross-indexed into this search result, not
Ordo- or Chuko-specific techniques. Still unconfirmed from a primary archery source —
treat the term list as archery-adjacent and UNVERIFIED, not Chuko-relevant at all.

Sources: [super.kg — 80ден ашык түрү бар чүкө оюндары](https://www.super.kg/article/show/59404), [kmborboru.wordpress.com — Кан таламай](https://kmborboru.wordpress.com/2012/10/09/kan-talamaj-2/)

## Recommendation for implementation

Given the spec's Section 8 (Chuko) calls for "touch, swipe, aim, timing, throwing,
collecting, scoring" mechanics with multiple modes, **Variant A (throw-and-collect)**
maps most directly onto that description and is the better-attested of the two —
recommend building the GameRules around Variant A, with Variant B's упай point table
as an optional secondary scoring mode, and hold off on the other named variants until
they're individually researched.
