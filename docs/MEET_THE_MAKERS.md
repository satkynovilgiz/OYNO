# Meet the Makers - schema, fixture and contributor checklist

Status: **schema only. The public entry is OFF** (`MAKERS_PUBLIC_ENABLED = false`) and there are
**no real profiles** (`MAKERS = []`). Nothing about any real person has been written.

- Schema and rules: `src/features/makers/makersModel.ts`
  - `validateMaker` lists every reason a profile can't be public. These are: missing or
    pending/withdrawn consent; granted consent with no recorded date or reference; name, bio or
    region outside the consent scope; no Kyrgyz bio; not approved in review; unknown related
    articles; media without consent, credit/license or a Kyrgyz description; fixture data.
  - `publicMakers` returns nothing while the flag is off, and never returns fixtures or invalid
    profiles.
  - `resolveMedia` shows a photo, audio or video only when it exists and is consented, credited
    and described. Otherwise it shows a neutral placeholder with the reason, never a stand-in
    image or sound.
- Internal demo: `/admin/makers` (behind `AdminGate`; non-admins get the not-found screen) shows
  `FIXTURE_MAKERS`. Its single entry is named "Demo maker (DEMO FIXTURE - not a real person)",
  its text says it isn't a real person, its consent is pending and all of its media fall back.
- Tests: `src/features/makers/makers.test.ts` covers schema validation, media fallback, fixture
  exclusion, the hidden entry, and that no non-admin screen links to the feature.

## Contributor content checklist (per maker)

1. **Written permission**, kept outside the app, with the date and an internal reference
   (`consent.recordedOn`, `consent.reference`). It states exactly what may be shown: name, bio,
   region, photo, audio, video (`consent.scope`). It also states how to withdraw. Withdrawal
   sets `status: 'withdrawn'`, and the profile disappears.
2. **Name** as the maker wants it written.
3. **Bio in the maker's own words**, or a text they approved: Kyrgyz required, Russian and
   English optional. Translations are reviewed by the maker or a named reviewer.
4. **Craft** and, only if agreed, **region**.
5. **Media**: for each photo or recording, the file, the photographer or recordist (credit),
   the license, and a description (alt text or transcript) in Kyrgyz.
6. **Related OYNO articles** that already exist (`relatedArticleIds`).
7. **Review**: a second person checks the facts against the maker's own statement, then sets
   `reviewStatus: 'approved'`.
8. **Turning the feature on**: only after at least one profile passes `validateMaker`, add a
   public route and entry, and flip `MAKERS_PUBLIC_ENABLED`. Update the hidden-entry test in the
   same change.

## Still needed before anything is public

- Real makers who agree to take part, with signed permission covering each field and medium.
- Their bios (KG; RU/EN optional) in their own words, and any photos or recordings with credit
  and license.
- A named reviewer for facts and translations.
- A decision on where permission records are stored and how withdrawal requests reach the team.
- The public screens (not built). Device checks: PENDING.
