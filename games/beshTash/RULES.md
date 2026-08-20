# Беш таш (Besh Tash) — Rules

"Беш таш" = "five stones" (also called "топ таш"). Traditionally a girls'/children's
solo dexterity game, single-hand jacks-family game played with 5 small round stones.

Status: **verified — two independently-worded sources converge on the same
progressive structure.** This is the real traditional sequence; do **not** replace it
with an arbitrary invented "5 difficulty levels" structure — the levels below ARE the
traditional structure, they just happen to number close to 5.

Sources: [ky.wikipedia.org — Беш таш, топ таш](https://ky.wikipedia.org/wiki/%D0%91%D0%B5%D1%88_%D1%82%D0%B0%D1%88,_%D1%82%D0%BE%D0%BF_%D1%82%D0%B0%D1%88), [kmborboru.wordpress.com — Беш таш (топ таш)](https://kmborboru.wordpress.com/2011/04/08/besh-tash-top-tash/), [open.kg — Besh Tash](https://open.kg/en/about-kyrgyzstan/culture/national-games/144-besh-tash.html)

## Equipment

- 5 small, round stones per player.

## Core rule: one hand only

The entire game is played with a **single hand** — the other hand may not assist at
any point. This is an explicit, named constraint in both sources and should be a hard
rule in the engine (not just a suggestion), e.g. reject/ignore any "second hand" input
if a two-handed control scheme is ever considered.

## Progressive sequence (the real structure)

Two sourced phrasings of the same underlying progression:

**Phrasing 1** (kmborboru / ky.wikipedia):
1. Throw all 5 stones up, catch them on the back of the hand, leave 1 stone balanced
   there, throw the remaining 4 to the ground, then toss the back-of-hand stone up and
   catch it in the palm.
2. Pick up the 4 grounded stones one at a time: toss the held stone up, grab one stone
   from the ground, catch the tossed stone together with the grabbed one — repeat.
3. Continue the same catch pattern but picking up grounded stones **two at a time**,
   then **three at a time**, then finally **all four at once** — completing the last
   stage wins that round.

**Phrasing 2** (open.kg, English), same idea stated as discrete stages with 4 stones
pre-placed on the ground and 1 in hand:
1. Toss 1 stone up, grab 1 from the ground, catch the tossed one.
2. Toss the 2 held stones up, grab 1 more from the ground, catch all in the air (3 in
   hand).
3. Toss the 3 held stones up, grab the 4th from the ground, catch all 4.
4. Toss up all 4, grab the 5th, catch all 5.
5. Toss all 5 up, clap the ground, catch all 5.

**Both phrasings describe the same shape**: a pick-up-one-more-each-round progression
from 1 stone to all 5, single-handed, with a slap-the-ground flourish at the final
stage. Implement this progression as the real GameRules structure — do not invent a
different level system.

## Longer-game variant

For extended play, sources mention a "slow" variant: toss all 5, catch 1 on the back
of the hand, toss it back up, catch it in the palm — essentially the opening move of
Phrasing 1, usable as a warm-up/lives-extension mechanic rather than a separate ruleset.

## UNVERIFIED

- Exact fail condition (e.g. does touching a stone you're not meant to pick up cost a
  life/turn, or end the round immediately?) — source implies "without touching any
  other stone" is required but doesn't spell out the penalty explicitly.
- Whether there's a formal win condition beyond "complete the sequence" (e.g. scoring
  across multiple players taking turns, best-of-N rounds) — not found in this pass.
