# Explain it yourself

- **Entry:** "Explain it yourself" on every article.
- **Routes:**
  - `/culture/item/[itemId]/explain` (the editor);
  - `/profile/explanations` (Profile → My explanations).
- **Code:**
  - `src/features/explain/` (`explainModel.ts`, `ExplainScreens.tsx`)
  - `src/store/useExplanationsStore.ts` (`oyno.explanations.v1`)

## Rules

- **Prompts:** three fixed, reviewed prompts that ask for the reader's own words and introduce no
  facts:
  - "How would you explain this to a friend?"
  - "What is the main idea, in a sentence or two?"
  - "What did you notice that you didn't know before?"
- **No grading:** the screen says these are your own words. OYNO never grades or checks them, and
  writing one isn't presented as mastery.
- **Source beside the writing:** on request, the article's sections are shown next to the text,
  labelled as reference and kept separate from the explanation. "Open the full article" leaves the
  draft in place.
- **Drafts:** kept in memory per owner and article in the shared draft registry, so they survive
  navigation. They are also listed in the **Recovery Center**, where retry is safe because saving
  is an update keyed by the article. Saving clears the draft only if it still matches what was
  sent.
- **Revisions:** the previously saved text stays exactly as it was until a revision is written. A
  failed save keeps both the old saved version and the new words on screen.
- **One entry per owner and article:** a revision never touches another owner's entry. The
  article title is kept as a snapshot, so writing for a removed article stays readable.

## Offline and backup (actual behaviour)

Explanations are stored only on this device, per account. They are **not synced and not in the
data export**. Writing and saving work offline. The source sections come from the cached article
list.

## Tests

- `src/features/explain/explain.test.ts`:
  - draft lifecycle, with newer typing kept;
  - fixed prompts;
  - revisions (count, no-op on unchanged, the old text kept on a failed revision, empty never
    saved);
  - owner separation;
  - removed articles keeping the writing;
  - serialized delayed writes.
- `src/features/recovery/recovery.test.ts` covers the Recovery Center integration.
- `e2e/tests/explain.spec.ts`:
  - article → explain → show source → open the article (draft kept) → save → reload → reopen →
    revise;
  - a removed article and another owner hidden (RU).

Device checks: PENDING.
