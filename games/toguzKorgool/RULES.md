# Тогуз коргоол (Toguz Korgool) — Rules

Kyrgyz national mancala-family strategy game. "Тогуз" = nine, "коргоол" = (literally)
sheep dung pellets, used historically as playing pieces.

Status: **mostly verified from Kyrgyz sources**, one mechanic (exact "tuz" declaration
threshold) flagged UNVERIFIED — see below.

## Setup

- Board: 18 pits total ("отоо"), arranged in two rows of 9, one row per player, facing
  each other. Each player additionally has one large collection pit ("казан"/kazan) at
  their right end.
- Each of the 9 pits starts with **9 korgools** → 81 stones per player, **162 total**.
- Players/teams: individual game; competitive team format for the game as a discipline
  is 5 people (2 men, 2 women, 1 coach), per World Nomad Games team-composition rules —
  this is a *competition/tournament* format detail, not a rule of play itself.

Sources:
- [Кабар — Всемирные игры кочевников: Правила игры "Тогуз коргоол"](https://kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-toguz-korgool/)
- [Sputnik Кыргызстан — "Кыргызские шахматы": тогуз коргоол — правила](https://ru.sputnik.kg/20180814/toguz-korgool-pravila-1040614103.html)
- [ky.wikipedia.org — Тогуз коргоол](https://ky.wikipedia.org/wiki/%D0%A2%D0%BE%D0%B3%D1%83%D0%B7_%D0%BA%D0%BE%D1%80%D0%B3%D0%BE%D0%BE%D0%BB)
- [worldnomadgames.kz — TOGYZQUMALAQ (Toguz korgool), team composition](https://worldnomadgames.kz/en/news/vidy-sporta/32)

## Turn structure

1. On your turn, pick up **all** the korgools from any one non-empty pit on your own
   side.
2. Sow them one at a time into consecutive pits going counter-clockwise / left-to-right
   (your remaining pits, then across into the opponent's row), skipping your own kazan.
3. **Capture rule**: if the *last* korgool you sow lands in an **opponent's** pit and
   that pit's new total is **even** (2, 4, 6, 8, …), the move is a capture — all
   korgools in that pit move to your kazan.

Source: [Кабар — Правила игры "Тогуз коргоол"](https://kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-toguz-korgool/), [Sputnik Кыргызстан](https://ru.sputnik.kg/20230831/toguz-korgool-igra-pravila-1077824986.html)

## The "tuz" (ace) special pit

- Once per game, each player may declare one of their own pits as their **"tuz"**
  ("ace"). From then on, any korgool landed there by either player is *immediately*
  captured by the tuz's owner (not just on an even-count last stone).
- **Pit #9** (the pit closest to a player's own kazan, called "ооз" in the Kyrgyz
  sources found) **can never be declared tuz**.
- A player cannot declare tuz on a pit if the opponent already holds the
  same-numbered pit as *their* tuz.
- A tuz, once declared, cannot be changed, and a player may only declare one tuz for
  the entire game. It must be marked (recorded as "X" in a written match protocol).

Source: [Кабар — Правила игры "Тогуз коргоол"](https://kabar.kg/news/vsemirnye-igry-kochevnikov-pravila-igry-toguz-korgool/)

**UNVERIFIED**: the exact numeric condition required to *declare* a pit as tuz (widely
cited for the closely-related Kazakh Togyzqumalak as "the pit must contain exactly 3
korgools at the moment of declaration") was not confirmed by a Kyrgyz-specific source
in this pass. Do not implement a 3-stone threshold as fact until a Kyrgyz federation
or cultural-heritage source confirms it applies identically here — flag this to a
cultural reviewer before finalizing the tuz mechanic.

## Win condition

- First player to collect **82 or more** korgools in their kazan wins immediately
  (82 is a bare majority of the 162 total stones in play).

Source: [search-synthesized from Кабар + Sputnik, see above]

**UNVERIFIED**: the standard mancala "starvation" end-condition (what happens if a
player has no legal move because all their pits are empty — typically the opponent
sweeps remaining stones into their own kazan) was not explicitly confirmed for the
Kyrgyz variant in this pass. Needs a primary-source rulebook (e.g. a written Kyrgyz
Togyz Korgool federation ruleset) before the engine encodes an end-of-game sweep rule.

## ⚠️ Regional/naming conflation flagged

A World Nomad Games results/news page titled its Toguz Korgool coverage
**"TOGYZQUMALAQ (Toguz korgool)"** and gave individual pit names (art, tekturmas, at
otpes, atsyratar, bel, belbasar, kandy kakpan, kokmoin, mandai) — these are **Kazakh**
naming conventions for Togyzqumalak, a sister game in the same mancala family, not
confirmed Kyrgyz terminology. Toguz Korgool (Kyrgyz) and Togyzqumalak (Kazakh) share
the same core mechanic (9 pits × 9 seeds, sow-and-capture-on-even, a "tuz"/"otau"
special pit) but are documented separately by their respective national federations.
**Do not present the Kazakh pit names as Kyrgyz terminology.** No individual Kyrgyz pit
names were found in Kyrgyz-language sources in this pass; if per-pit naming is wanted
in the UI, that needs a dedicated follow-up search of Kyrgyz-language sources only.

Source: [worldnomadgames.kz — TOGYZQUMALAQ (Toguz korgool)](https://worldnomadgames.kz/en/news/vidy-sporta/32)

## Timing (competitive format)

- Updated tournament rules reportedly give each player a total of one hour of
  thinking time (so a full game runs up to ~2 hours). This is a *competition* clock
  rule, not core game logic — implement as an optional/configurable timer, not a hard
  engine rule.

Source: [Sputnik Кыргызстан — тогуз коргоол правила](https://ru.sputnik.kg/20180814/toguz-korgool-pravila-1040614103.html)
