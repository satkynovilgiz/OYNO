# Ак терек, көк терек (Ak Terek — Kok Terek) — Rules

"White Poplar, Blue Poplar" — a Kyrgyz children's call-and-response team-tag game.

Status: **core mechanic verified**; win/round-resolution condition **UNVERIFIED**.

Source: [ky.wikipedia.org — Ак терек, көк терек](https://ky.wikipedia.org/wiki/%D0%90%D0%BA_%D1%82%D0%B5%D1%80%D0%B5%D0%BA,_%D0%BA%D3%A9%D0%BA_%D1%82%D0%B5%D1%80%D0%B5%D0%BA)

## Setup

- Children split into two teams by lot (a white/black draw).
- Each team lines up in a row, **facing the other team**, holding hands firmly with
  their own teammates (forming an unbroken human chain/wall).

## The call-and-response

1. The team with the right to start chants together: **"Ак терек, көк терек, бизден
   сизге ким керек?"** ("White poplar, blue poplar, which of us do you need?")
2. The opposing team names one specific player from the calling team.
3. **That named player runs at the opposing team's line** and tries to break through
   their linked hands at what they judge to be the weakest point.

This is the real mechanic — **it is a targeted breakthrough attempt against a chosen
weak point in a human chain, not a generic "movement + reaction challenges" game** as
a first read of the spec might suggest. Implement the core loop around: (a) naming/
selection phase, (b) the runner choosing a target point along the opposing line, (c) a
breakthrough resolution.

## UNVERIFIED

- **What happens on success vs. failure** was not stated in the source retrieved:
  standard versions of this game type (it has close cousins across many cultures)
  typically have the runner join the other team if they fail to break through, and
  take a player back to their own team if they succeed — but this specific resolution
  was **not confirmed for the Kyrgyz version** in this pass. Do not hard-code either
  resolution without confirming.
- Number of players per team, field/line spacing, and whether there's an overall
  match win condition (e.g. first team to deplete the other) were not found.

## Recommendation

Flag this whole "success/failure consequence" question to a cultural reviewer before
finalizing GameRules — it's the one piece of core game logic this pass couldn't
confirm, and guessing wrong would misrepresent how the game is actually resolved.
