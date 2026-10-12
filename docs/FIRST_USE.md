# First-use guide ("Help me get started")

An optional guided tour that extends onboarding. Files: `src/features/firstUse/`
(model and screen), `src/store/useFirstUseStore.ts` (`oyno.firstUse.v1`), route `/start`.

**When it's offered.** At the end of onboarding (guest or account), `offer('guest')` marks it.
Finishing profile setup for a new account calls `offer(<user id>)`. Home then shows a card with
"Help me get started" or "Skip". An owner who already has a record (skipped, finished or
active) isn't offered it again, and users who finished onboarding before this feature never see
it unprompted. Replay is always available from Settings → Help → "Getting started guide".

**Steps** (explicit, in order; "Skip the guide" at any point):
1. **Discover an article**: the suggested `boz-uy-overview`, or the first available one. Opening
   it marks the step.
2. **Make a small design**: choose a motif, then a colour, then tap the canvas or Place. It has a
   12-motif limit and Undo. "I'm happy with it" needs at least one motif.
3. **Choose whether to save.**
   - **Signed in:** an optional name, then "Save this design". This uses the existing
     `saveOymoCreation`.
     - "Saved" is announced and the step recorded only after the save succeeds
       (`saveGuideDesign`).
     - On failure the design stays and an error is shown.
     - "Continue without saving" is always available.
   - **Guest:** the screen explains that designs are saved to an account, so a guest's design
     isn't saved. "Sign in to save" keeps the design in memory (`awaitingAuth`). After sign-in
     the app returns to `/start`, where the design and the guide progress pass to that account
     once. Any other change of account drops the unsaved design (`draftFor`).
4. **Find it on My OYNO Shelf**: the screen says honestly whether the design was saved.

**Progress** is stored per owner on this device and resumes after a restart; Home shows
"Continue". It records only which steps were done and the save choice, never scores, levels or
claims of mastery. Store writes are serialized and write-first: a failed write is reported, and
an unreadable store blocks writes until Retry.

**Tests**
- Unit: `src/features/firstUse/firstUse.test.ts` covers step order, skipping, resuming, replay,
  per-owner progress, owner changes, the auth handoff, write failure, save success and save
  failure.
- E2E: `e2e/tests/first-use.spec.ts`.
  - First visit → onboarding → Home offer → article → guided design → "Sign in to save" →
    back, with the design kept → continue without saving → shelf → finished → Help replay.
  - Skip, then resume after a reload.
  - Existing users aren't offered it.

**Not covered by E2E:** the signed-in save → shelf path. The fake e2e backend is guest-only, with
no auth session and no `save_oymo_creation` RPC. Save success and failure are covered by the unit
tests. Signed-in save → find on a real account: **PENDING** (device/staging check).
Device checks: PENDING.
