# My Questions

**Model:** `src/features/questions/questionsModel.ts`.
**Store:** `src/store/useQuestionsStore.ts` (`oyno.questions.v1`).
**Screens:** `QuestionsScreens.tsx`.
**Routes:** `/profile/questions` and `/profile/questions/[questionId]`. Both are private in the
diagnostic route sanitizer.

## Flow

1. **Save a question** appears under every article section, next to the Reading Companion
   bookmark. Write the question in your own words, then **Save question**. The draft is kept in
   memory per owner and section, so it survives in-app navigation away from the article. It is
   not kept across an app restart.
2. **My Questions** (Profile → My Questions) has two tabs: **Still exploring** and **Answered for
   now**.
3. **The question screen**, top to bottom:
   - the question, editable;
   - **Asked while reading**: the origin;
   - **From OYNO's articles**: up to 6 articles you link, found by searching titles;
   - **Your own answer**: always labelled as your words. OYNO doesn't write, check or certify
     answers;
   - **Save changes** (question text and answer), **Mark "Answered for now"** / **Reopen**, and
     **Delete** with a confirmation.

## Rules

- **Origin:** a stable reference, made of the article id and section key, plus a snapshot of the
  title and section label.
  - If the section is no longer in the article, the screen says so and offers the article top.
    It never attaches the question to another section.
  - If the article is gone, the question stays with its saved titles.
- **Linked articles:** shown by their live title. A removed article shows its saved title and
  "No longer available"; the other links are unaffected.
- **Answered for now:** only changes the status. The question, its links and the answer stay, and
  it can be reopened.
- **Writes:** serialized and write-first. A change is computed from the latest stored state, so
  two delayed writes both land. A failed write isn't shown: the fields keep what you typed, with
  Retry. Saving clears a draft only if it still equals what was sent, so text typed during a save
  survives. An unreadable store is an error state that blocks writes.
- **Privacy:** records are kept per owner, so another account sees none of them. Drafts are also
  per owner.

## Offline and backup (actual behaviour)

Questions are stored only on this device, per account. They are **not synced, not in the data
export, and not restored on another device**. Linked articles come from the cached article list,
so they open offline once they have been loaded. Otherwise the screen says it's loading, or that
the article isn't available.

## Tests

- `src/features/questions/questions.test.ts`:
  - lifecycle (answered and reopen keep everything; limits; no-ops);
  - section and article removal (never reattached);
  - ownership;
  - write failure;
  - serialized delayed writes;
  - edits typed during a save;
  - unreadable store;
  - delete.
- `e2e/tests/my-questions.spec.ts`:
  - section → question (draft survives navigation) → supporting article (open and back) →
    personal answer → answered → list → reopen, plus a storage check;
  - a vanished section and article, other owner's questions hidden, confirmed delete.

Device checks: PENDING.
