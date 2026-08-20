# Games research summary — read before approving any implementation

Research pass completed for all 9 games (spec Sections 7–15) plus Beshbarmak
(Section 16). **No implementation code has been written for any game** — per
instructions, this stops here for review. Cooking World's other 8 dishes
(Section 17) are explicitly out of scope for this pass — see the note in
`games/beshbarmak/RULES.md`.

Method: web search across Kyrgyz, Russian, and English/World-Nomad-Games queries per
game; every rule claim cites a source; anything not confidently sourced is marked
UNVERIFIED rather than filled in with a guess, per the hard "do not invent" constraint
in spec Section 43.

## Status at a glance

| Game | File | Core mechanic confidence | Biggest open question |
|---|---|---|---|
| Тогуз коргоол | `games/toguzKorgool/RULES.md` | High — converging Kyrgyz sources | Exact "tuz" declaration threshold (likely 3 stones, unconfirmed for Kyrgyz specifically) |
| Ордо | `games/ordo/RULES.md` | High for field/khan; medium for exact piece count | Source's own piece-count arithmetic is internally inconsistent (68 vs 70) |
| Чүкө | `games/chuko/RULES.md` | Medium — it's a *family* of 80+ variants, not one game | Which single variant (if any) should be "the" in-app default; documented two (throw-and-collect, упай points) |
| Беш таш | `games/beshTash/RULES.md` | High — two sources converge on the same progression | Fail-condition penalty not spelled out |
| Аркан тартыш | `games/arkanTartysh/RULES.md` | Medium — field/teams solid, win condition inferred not stated | Win condition (ribbon past line) is the *obvious* reading but not found as an explicit sentence |
| Ак терек — көк терек | `games/akTerekKokTerek/RULES.md` | Medium — the call-and-response mechanic is solid | What happens on breakthrough success vs. failure — not found |
| Жоолук таштамай | `games/zholukTashtamay/RULES.md` | Medium-high — corrects a wrong spec assumption (it's not a courtship game) | Exact forfeit when the walker is caught |
| Жаа атуу | `games/zhaaAtuu/RULES.md` | **Low** — only historical technique names found, no modern rules | Everything: distances, scoring, equipment. Needs a dedicated follow-up pass. |
| Кыз куумай | `games/kyzKuumay/RULES.md` | High for structure | **Design decision needed, not a research gap**: traditional resolution is a kiss — needs an explicit non-literal treatment for an all-ages app before implementation |
| Бешбармак | `games/beshbarmak/RULES.md` | High | Exact quantities (only if the product wants a precision recipe card, not needed for a cooking-game step flow) |

## Two corrections this pass made to the spec's own assumptions

1. **Жоолук таштамай is not a courtship game.** The spec itself hedged ("traditionally
   a handkerchief-based social/courtship game") — the sourced mechanic is a circle tag
   game (structurally close to what's called "Duck Duck Goose" in English), not
   courtship-themed. Built to the real mechanic in the RULES.md.
2. **Ак терек — көк терек is a targeted breakthrough game**, not generic "movement +
   challenges" — a named opponent must break through a specific weak point in a
   linked-hands chain, following a specific chant.

## Items that need a human cultural reviewer before their game is finalized (not just more searching)

- **Тогуз коргоол**: confirm the tuz declaration threshold.
- **Ордо**: resolve the piece-count arithmetic inconsistency (ideally via the official
  PDF at `worldnomadgames.org/.../Ordo-rules-en.pdf`, which returned HTTP 403 when
  fetched automatically in this pass — someone with normal browser access should be
  able to retrieve it).
- **Ак терек — көк терек**: confirm the success/failure resolution.
- **Жоолук таштамай**: confirm the exact forfeit and the seating/blindfold detail.
- **Жаа атуу**: needs a full dedicated research pass, not just a review of gaps.
- **Кыз куумай**: this is a *product/sensitivity decision* (how to represent the
  traditional "catch" resolution respectfully for an all-ages app), not something
  more research resolves — needs your explicit call.

## Recommended next step

Per your instructions, implementation should follow Section 46's task order once
review is done. Suggested build order by readiness (most-verified/lowest-risk first):
**Беш таш → Тогуз коргоол → Кыз куумай (pending the sensitivity decision) → Жоолук
таштамай → Аркан тартыш → Ордо → Ак терек-Көк терек → Чүкө (pick a variant) → Жаа атуу
(after its follow-up research pass)**. Waiting for your review before starting on any
of them.
