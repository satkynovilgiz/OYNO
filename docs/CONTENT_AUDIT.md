# OYNO — Content Quality & Localization Audit

Audited **2026-09-26** against `main` and the live Supabase public tables
(read-only REST, anon key; no writes). Statuses: **OK**, **COPY FIX**,
**TRANSLATION FIX**, **FACT CHECK**, **IMAGE REVIEW**, **MISSING
LOCALIZATION**, **DUPLICATE**, **PLACEHOLDER**.

**OYNO is not fully localized.** UI strings are complete in KG/RU/EN; most
authored *cultural content* exists only in Kyrgyz (see counts).

## 1. Localization counts

| Source | Items | KG | RU | EN | Status |
| --- | --- | --- | --- | --- | --- |
| UI strings (`src/i18n/locales/*.json`) | 1709 keys each | ✔ | ✔ | ✔ | Full parity; no empty or placeholder strings (tested) |
| Culture items (`culture_items`) | 230 | ✔ | ✘ | ✘ | **Single-language source.** `simple_summary_ru/en` columns exist but are empty for all 230; the app says "only in Kyrgyz" honestly |
| Culture categories (`culture_categories.title`) | 10 | DB | overlay | overlay | **Fixed** — RU/EN readers saw "Улуттук кийим", "Ат маданияты"… (`cultureCategoryTitles.ts`) |
| Culture materials (`culture_materials`) | 4 | ✔ | ✘ | ✘ | Single-language; `kyz-kuumai-game` has no body |
| Explore names (`name_kg/ru/en`) | 14 | ✔ | ✔ | ✔ | OK |
| Explore taglines (`tagline`) | 14 | DB | overlay | overlay | **Fixed** — RU/EN saw Kyrgyz taglines on cards, detail and Search (`regionTaglines.ts`) |
| Explore facts (`facts`) | 29 lines | ✔ | ✘ | ✘ | Single-language; several need verification (§5) |
| Discoveries (`title_kg/ru/en`) | 4 | ✔ | ✔ | ✔ | OK |
| Quest (`quests`) | 1 | ✔ | ✘ | ✘ | Single-language; subtitle features **Бөрү**, a companion not yet available (Coming Soon) |
| Daily OYNO | = culture items | ✔ | ✘ | ✘ | Inherits culture-item limitation |
| Challenges (i18n) | 27 questions | ✔ | ✔ | ✔ | Localized; claims in §5 |
| Trails / Collections (code) | 4 / 3 | ✔ | ✔ | ✔ | Titles + intros in all three (tested) |
| Game names | 12 | ✔ | ✔ | ✔ | Standardized (§3) |

**Summary:** fully localized: UI, explore names, discoveries, challenges,
trails, collections, game names · partially localized (overlay over a
single-language column): culture categories, explore taglines ·
single-language (Kyrgyz): 230 culture items, 4 materials, explore facts,
1 quest, Daily · missing: none of the UI keys.

**Schema limitation (not changed):** `culture_items`, `culture_categories`,
`culture_materials`, `explore_regions.tagline/facts` and `quests` have one
authored text column. The overlays are a stopgap for short labels only;
long-form content needs `_ru/_en` columns (or a translations table) plus
authored translations. No per-language duplicate rows were added.

## 2. Fixes made

| Area | Issue | Fix | Type |
| --- | --- | --- | --- |
| Explore | RU/EN showed Kyrgyz taglines | RU/EN overlay, KG stays from DB | MISSING LOCALIZATION |
| Culture | RU/EN showed Kyrgyz category names | RU/EN overlay (Culture, category screen, Search, Saved) | MISSING LOCALIZATION |
| Games | RU/KG titles "Бешбармак Challenge", "Боз үй Cooking World" (hidden by a test allowlist) | "Испытание «Бешбармак»" / "Бешбармак сынагы", "Кухня боз үй" / "Боз үй ашканасы"; allowlist tightened | TRANSLATION FIX |
| Places | Son-Kol spelled 5 ways | KG **Соң-Көл**, RU **Сон-Куль**, EN **Son-Köl** in UI; DB fix in `supabase/migrations/20260926000001_content_spelling_son_kol.sql` (**not applied** — needs the project owner) | COPY FIX |
| Kok Boru | "Kyrgyz horseback polo" (EN/RU); EN "object" | Traditional horseback game; one-on-one simplification stated; "ulak" in EN | COPY FIX |
| Game names | EN "Kök Börü"/"Kok Boru", RU "Чүкө"/"Чуко", archery translated vs others transliterated | EN Kok Boru, Chuko, Jaa Atuu; RU Кок бору, Чуко, Жаа атуу | COPY FIX |
| Chuko KG | pieces called "таш" (stone); miss = "Өттү" (passed) | "чүкө", "Тийген жок" | TRANSLATION FIX |
| Kyz Kuumai KG | Sprint called "чуркоо" and "ЖҮГҮРнү" | Consistent "ЖҮГҮР баскычы" / "тездетүү" | TRANSLATION FIX |
| Games | Units "s", "m", "m/s" hardcoded English | Localized units, decimal comma for RU/KG | MISSING LOCALIZATION |
| Auth | Two unused empty KG keys | Removed | PLACEHOLDER |

## 3. Standard names

| Game | KG | RU | EN |
| --- | --- | --- | --- |
| Archery | Жаа атуу | Жаа атуу | Jaa Atuu |
| Ordo | Ордо | Ордо | Ordo |
| Chuko | Чүкө | Чуко | Chuko |
| Kyz Kuumai | Кыз куумай | Кыз куумай | Kyz Kuumai |
| Kok Boru | Көк бөрү | Кок бору | Kok Boru |

Places use one display name per language; alternates belong only in search
metadata (`alt_names`, `name_*`).

## 4. Area notes

- **Culture** — 230 items: 165 `unverified`, 65 `partially_verified`, 0
  verified; 0 have `image_url` (bundled art is used where it exists).
  Customs content (weddings, funerals, birth, spiritual) comes from
  `content/culture/*.md` research and is flagged there; nothing rewritten.
- **Explore** — names consistent after Son-Kol fix. Arslanbob: KG proper
  form is **Арстанбап** (used inside its own fact) while the display name
  is "Арсланбоб" — naming decision needed.
- **Daily** — no fabricated facts; content = culture items.
- **Challenges** — answers follow OYNO content; several rely on claims in §5.
- **Games** — tutorials match controls (verified against the code: Jaa
  Atuu hold-to-draw, Kyz Kuumai stamina is real). Every about card says
  when the digital version is simplified.
- **Trails / Collections** — stops reference real content ids (tested).
- **System UI** — notifications are short and specific (no "We miss
  you", no streak guilt). Privacy/Terms text **not edited** — needs
  professional legal review (RU privacy lists "кристаллы" among stored
  data; gems are never earned in the app).

## 5. Needs Human Verification

| Content id | Claim | Reason | Recommended source |
| --- | --- | --- | --- |
| explore `son-kol` tagline + challenge `image-son-kol` | "Formed by glaciers" | Origin commonly described as tectonic | Geological survey / academic limnology |
| explore `son-kol` fact | Frozen late September to May | Dates vary by source | Hydromet data |
| explore `ysyk-kol` fact | "2nd clearest after Baikal", never freezes, 702 m | Clarity ranking unsourced; depth varies (668–702 m) | Encyclopedic / limnology source |
| explore `sary-chelek` fact + challenge | 244 m deep, 2nd deepest | Sources give 234–244 m | Reserve administration / UNESCO |
| explore `arslanbob` tagline + challenge | "World's largest walnut forest" | Usually "largest natural walnut-fruit forest" | FAO / forestry studies |
| explore `talas` facts | Semetey returns to Talas; Manas in Guinness as longest epic | Guinness claim widely repeated, not confirmed | Manas scholarship; Guinness record DB |
| explore `bishkek` facts | Founded 1878 as Pishpek; population "close to 1 million" | Kokand fortress predates 1878; population now > 1.1 M | National Statistical Committee |
| explore `batken` fact | Oblast formed 13 October 1999 | Commonly given as 12 October 1999 | Official decree |
| explore `ala-too` fact | 454 km, Alamedin 4,895 m | Figures vary | Topographic reference |
| explore `alay` + challenge `lenin-peak` | Lenin Peak on "Chong Alay" range | EN naming ambiguous (Trans-Alay vs Alay) | Geographic reference |
| challenge `kochkor-muyuz` | Ram's-horn motif "sets Kyrgyz ornament apart"; "no pattern without it" | Motif shared across Turkic/Central Asian ornament | Ethnographic/art-history source |
| challenges `shyrdak-edges`, `shyrdak-blue` | Colour symbolism (edges = snowy peaks; blue = Tengri) | Symbolism varies by source | Ethnographic studies of felt craft |
| challenge `hooves` | Kyrgyz horses need no shoeing, graze year-round | Generalisation | Veterinary / breed source |
| challenge `komuz-strings` | "Oldest Kyrgyz" instrument | Superlative unsourced | Organology source |
| challenge `kok-boru-rules` | Modern rules by Bolot Shamshiev, 1996 | Attribution needs a source | Kok-boru federation records |
| culture items (165 `unverified`) | Customs, rituals, origins | Marked unverified in DB | Ethnographers / cultural institutions |

## 6. Image review

| Asset | Issue | Status |
| --- | --- | --- |
| `assets/img/culture/Komuz.png` | 4 tuning pegs (komuz has 3 strings), separate fingerboard and guitar-style bridge — a komuz is carved from one piece, fretless | IMAGE REVIEW (object accuracy) |
| Culture / Explore / Home artwork (`*Golden Hour*`) | AI-generated illustrations; no copy presents them as photographs or historical evidence | OK — keep illustrative |
| Game detail photos (e.g. Kyz Kuumai) | Appear photographic — confirm licence/attribution | IMAGE REVIEW (licence) |
| `assets/icon.png` | Expo template | PLACEHOLDER — release blocker (DEVICE_QA RC-1) |
| Characters Бөрү / Тулпар / Элчи | No complete character sheets | Kept Coming Soon |
| `assets/img/OYNO_design/avatar/{faceshape,eyebrows,nose,mouth,hair}_*.png` (32 files) | 80×82 px crops from a design sheet, shown at 72 pt (blurry at 3×), with neighbouring cards' frames baked into the crop | IMAGE REVIEW — re-export each part centred, transparent, ≥ 256 px |
| `bust_boy.png` / `bust_girl.png` | One portrait per base; hair/headwear/clothing choices don't change the profile picture (documented in UserAvatar) | Known limitation — layered art needed |

## 7. Tests added

`src/i18n/contentIntegrity.test.ts`: no empty strings, no placeholder
markers, every game titled in 3 languages, trails/collections titled and
introduced in 3 languages, every destination and culture category covered
by the RU/EN overlays. `localeParity.test.ts` allowlist no longer hides
English words in RU/KG.
