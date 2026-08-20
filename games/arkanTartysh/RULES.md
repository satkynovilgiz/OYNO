# Аркан тартыш (Arkan Tartysh) — Rules

Kyrgyz team tug-of-war. "Аркан" = rope, "тартыш" = pulling/contest. (Note: Kyrgyz
Wikipedia has separate articles for "Аркан тартыш" and "Аркан тартмай" — likely
name/regional variants of the same game; only the former was retrieved in depth this
pass.)

Status: **basic field/team setup verified**; match format (rounds, timing, foul rules)
**UNVERIFIED**.

Source: [ky.wikipedia.org — Аркан тартыш](https://ky.wikipedia.org/wiki/%D0%90%D1%80%D0%BA%D0%B0%D0%BD_%D1%82%D0%B0%D1%80%D1%82%D1%8B%D1%88) (also see [Аркан тартмай](https://ky.wikipedia.org/wiki/%D0%90%D1%80%D0%BA%D0%B0%D0%BD_%D1%82%D0%B0%D1%80%D1%82%D0%BC%D0%B0%D0%B9) — unconfirmed whether identical rules or a distinct regional variant, flag for review)

## Teams

- **10 participants total** (two teams pulling from opposite ends of one rope).
- Spec Section 11 asks for "Green Team vs Red Team" — that's a presentation choice for
  OYNO, not a traditional rule; keep OYNO's own team colors for the UI, unrelated to
  any traditional team-color convention (none was found in sources).

## Field setup

- A rope is laid out with a **colored ribbon tied at its exact center**.
- **Three lines** are drawn on the ground perpendicular to the rope: one center line
  (under the ribbon at rest) and two outer lines, each up to **2 meters** from the
  center line.
- Team members grip the rope alternating sides/positions along their half.

## Play

- On a starting signal (called by a player or an official/spectator), both teams pull,
  trying to drag the rope — and therefore the center ribbon — toward their own side.
- **Win condition (inferred from the field setup, not explicitly spelled out in the
  source snippet retrieved)**: standard tug-of-war logic implies a team wins when the
  center ribbon crosses their own outer line. This is the natural reading of "3 lines,
  outer lines up to 2 m from center" but **was not found as an explicit win-condition
  sentence in this pass — treat as UNVERIFIED until confirmed**, even though it's the
  overwhelmingly likely reading.

Source: [ky.wikipedia.org — Аркан тартыш](https://ky.wikipedia.org/wiki/%D0%90%D1%80%D0%BA%D0%B0%D0%BD_%D1%82%D0%B0%D1%80%D1%82%D1%8B%D1%88)

## UNVERIFIED

- Match format: single pull, or best-of-N.
- Any foul rules (e.g. sitting/anchoring technique restrictions, rope-wrapping rules
  common in international tug-of-war but not confirmed for the Kyrgyz traditional
  version specifically).
- Whether "Аркан тартмай" (separate wiki article) is the same game under a regional
  name or a distinct variant — needs a follow-up read of that article before this is
  finalized.

## Product-spec note

Spec Section 11 explicitly says "do NOT make this simply 'tap extremely fast'" and
wants rhythm/timing/coordinated-swipe mechanics. That's a legitimate *game-feel*
design decision for OYNO's implementation and doesn't need a traditional-rules
citation — it's an interpretation layer on top of the real win condition above, not a
claim about how the traditional sport is officiated.
