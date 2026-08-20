# Кыз куумай (Kyz Kuumai) — Rules

"Кыз" = girl, "куумай" = to chase. One of the oldest Kyrgyz equestrian games.

Status: **core structure verified**; this significantly narrows and corrects the
generic "horse racing/chase game" framing in the product spec.

Source: [ky.wikipedia.org — Кыз куумай](https://ky.wikipedia.org/wiki/%D0%9A%D1%8B%D0%B7_%D0%BA%D1%83%D1%83%D0%BC%D0%B0%D0%B9), [super.kg — Кыз куумай](https://www.super.kg/article/show/2855), [kmborboru.wordpress.com — Кыз куумай](https://kmborboru.wordpress.com/2009/11/12/kyz-kuumaj/)

## Structure — this is a two-phase chase-and-catch game, not a generic race

1. **Phase 1**: the girl rides first, given a head start; the boy chases on
   horseback.
2. **Resolution**: if the boy catches up to her before the distance ends, he "kisses
   her, from the face" as the traditional mark of having won by demonstrating his
   speed (source's own phrasing).
3. **Phase 2 (if the boy fails to catch her)**: the roles reverse — the girl now
   chases the boy back over the course. (The source states the game "continues in
   reverse" but does not spell out the exact win condition/consequence for this second
   phase — see UNVERIFIED.)

- Players: **2 to 20** can participate (i.e. this can run as a single pair or a group
  event with multiple pairs).
- Course: up to **1.5 chakyrym** (a traditional distance unit — needs conversion
  research, do not assume a modern-meters equivalent without checking; a modern
  hippodrome track is cited as the contemporary equivalent venue).

## ⚠️ Design/cultural-sensitivity flag — important for an all-ages app

This game's traditional resolution involves a **kiss** as the "boy wins" outcome. The
product spec (Section 15) explicitly requires: *"Do not sexualize the characters. Keep
the presentation respectful and culturally appropriate,"* and the app must work for
children as well as adults (spec intro). **This needs an explicit design decision
before implementation** — e.g. representing the "catch" moment with a stylized,
non-literal gesture (a wave, a flower toss, a high-five, a culturally-appropriate
symbolic animation) rather than an animated kiss, especially given younger players.
**Do not implement a literal kiss animation without this being explicitly signed off**
— flagging this for review rather than deciding it unilaterally, since it's a product/
cultural-sensitivity call, not a pure rules question.

## UNVERIFIED

- Exact win condition for Phase 2 (girl chasing boy) — is there an equivalent
  "consequence" for the boy being caught, or does the game simply end?
- Conversion of "1.5 chakyrym" to a modern distance.
- Whether there's a formal scoring/tournament structure beyond the single
  chase-and-catch resolution (e.g. for the 2–20 player group format).

Related, separately-documented traditional sport in the same source cluster: **Ат
чабыш** (straight horse racing, 1200 m – 50 km, with explicit fouls: no shortcuts, no
whipping another rider's horse, no leaving the track) — this is a *different* game
from Kyz Kuumai and not part of the spec's game list, noted here only because it
surfaced in the same search and could be confused with it.
