# Бешбармак (Beshbarmak) — Recipe/Process Reference

Spec Section 16 frames this as an interactive cooking experience, not a competitive
game — this document is the recipe-accuracy equivalent of a RULES.md, per Section 43
("do not invent recipes and present them as authentic... label regional variations").

Status: **process verified from Kyrgyz-language cooking sources**; regional
variation explicitly labeled per the spec's hard requirement.

Sources: [nur.kz — Бешбармак классический рецепт](https://www.nur.kz/food/recipes/1604632-beshbarmak-recept-klassicheskiy/), [eda.rambler.ru — Бешбармак, киргизская кухня](https://amp.eda.rambler.ru/recepty/osnovnye-blyuda/beshbarmak-139558), [tastesfromtheroad.com — Beshbarmak From Kyrgyzstan](https://www.tastesfromtheroad.com/recipes/beshbarmak-from-kyrgyzstan)

## The real process, matching the spec's 10-step shape reasonably well

1. **Ingredients**: meat (traditionally horse, lamb, or beef — varies by region, see
   below), onion, flour/water/egg/salt for dough, bay leaf, black pepper, carrot
   (for the broth).
2. **Prepare meat**: cut into a few large pieces.
3. **Boil meat**: place in cold water, bring to a boil, add onion/carrot/bay
   leaf/pepper, simmer **3–4 hours**, skimming fat off the surface periodically
   (the skimmed fat is reserved, not discarded — used later).
4. **Prepare dough**: simple unleavened dough (flour, water, salt — egg in some
   versions).
5. **Roll dough**: roll into a thin sheet.
6. **Cut noodles**: cut into strips — **the Kyrgyz tradition specifically uses long
   noodle strips** (a distinguishing detail vs. some other regional shapes).
7. **Cook noodles**: boil the noodles in strained broth (not plain water) — this is a
   specific, easy-to-miss detail: the noodles take on flavor from the meat broth.
8. **Prepare onion (sauce)**: thin onion half-rings, gently simmered in a little
   broth for 10–15 minutes, seasoned with pepper. **This onion-broth sauce is
   notably thicker in the Kyrgyz version than the Kazakh version** — the one
   concretely sourced Kyrgyz-vs-Kazakh distinction found (see below).
9. **Arrange dish**: mix the meat into the onion sauce, then combine with the cooked
   noodles and mix well (rather than layering meat separately on top, per this
   source's method — some presentations do plate noodles-then-meat-on-top; treat
   exact plating as a presentation choice, not a hard rule).
10. **Serve**: traditionally on a large shared platter.

## Regional variation — explicitly labeled, per Section 43

- **Kyrgyz vs. Kazakh**: the most concretely sourced difference is that the onion
  sauce ("туздук"-style sauce) is **thicker in the Kyrgyz version**. Beyond that,
  the dish is described as *shared heritage* between the two countries, not
  exclusively either one's — do not present it in-app as belonging to only one
  country.
- **Within Kyrgyzstan**: regional variation exists in meat choice (horse/lamb/beef)
  and in noodle shape/size — do not hard-code a single "correct" meat or noodle
  shape; if the interactive cooking game wants a single default for playability,
  label it explicitly as "one common version" in the UI/tutorial text, not "the"
  version.
- **Kazakhstan-specific variants found** (for contrast, not to be presented as
  Kyrgyz): Western Kazakhstan fish beshbarmak (Caspian sturgeon/catfish), Southern
  Kazakhstan spicier tuzdyk with more black pepper/chili and sometimes two meat
  portions per person. **Do not attribute these to Kyrgyzstan.**

## UNVERIFIED

- Precise ratios/quantities (flour:water:egg for dough, broth reduction amounts) —
  the sources give technique, not exact measurements; a cooking-game interactive
  step doesn't strictly need gram-precision, but if the product wants a "real
  recipe card" output, exact quantities need a dedicated recipe source.
- Whether kymyz (fermented mare's milk) or another specific accompaniment is
  traditionally served alongside — not confirmed in this pass.

## Note on the rest of "Cooking World" (spec Section 17)

The spec also lists **Курут, Боорсок, Куурдак, Чучук, Кымыз, Жарма, Максым, Чалап** as
separate dishes needing the same recipe-accuracy treatment. **Not researched in this
pass** — this document covers Beshbarmak only, since it's the one explicitly listed as
"Game #10" alongside the 9 games. Each of the other 8 dishes needs its own dedicated
research pass with the same rigor (verified sources, regional variation labeled,
UNVERIFIED flags) before any interactive step content is written for them — flagging
this as an explicit backlog item rather than silently skipping it.
