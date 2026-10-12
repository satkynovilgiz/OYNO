# Theme tags

- **Screens:** Profile → **My tags** (`/profile/tags`) and one tag (`/profile/tags/[tagId]`, private
  in the route sanitizer).
- **Tag picker:** on the question screen and the scrapbook editor.
- **Code:** `src/features/tags/` (`tagsModel.ts`, `TagScreens.tsx`) and `src/store/useTagsStore.ts`
  (`oyno.tags.v1`).

## Rules

- **Personal organisation, not cultural classification.** The screens say so.
- **References only:** a tag stores a stable record type plus id. The types are reading notes
  (bookmark key), questions, listening moments, scrapbooks, Oymo designs and discovery boards.
  Records are never copied or written by tagging (the E2E test checks the stored records are
  byte-identical). **Time capsules can't be tagged**, so sealed contents never appear here.
- **Opening a record:** each tagged record is read from its own store, for the current owner only,
  and opens in its existing screen.
- **Missing records:** a record that was deleted (or belongs to another account) shows as "no
  longer available" with **Remove from tag**. Removing it affects only that reference.
- **Rename:** names are unique (case-insensitive) and cleaned. Every view reads the one tag, so a
  rename shows everywhere at once.
- **Merge:** moves all references into another tag, removes duplicate references, and deletes the
  merged tag.
- **Delete:** asks for confirmation and removes only the tag and its references. **Source records
  are untouched.**
- **Writes:** serialized and write-first. A failed or not-allowed change reports an error and
  nothing changes. An unreadable store is an error state that blocks writes until Retry.
- **Ownership:** tags are stored per owner, and another account never sees or changes them.
- **Limits:** at most 50 tags, with up to 200 references each.

## Backups (actual behaviour)

Tags are stored **only on this device**, per account. They are **not synced and not included in
any backup or export**. If records come back from a backup with the **same ids**, existing tags
find them again. Otherwise those references show as "no longer available" and can be removed.

## Tests

- `src/features/tags/tags.test.ts`:
  - identity (stable references, no duplicates, capsules not taggable);
  - unique, cleaned names;
  - rename;
  - merge removing duplicates;
  - delete;
  - missing references;
  - normalization;
  - per-owner store;
  - failed writes;
  - an unreadable store.
- `e2e/tests/tags.spec.ts`:
  - tag a question and a scrapbook → tag view (2 records) → filter → rename → reload → open a
    record (the renamed tag shows there), with records unchanged;
  - missing placeholder and remove, another owner hidden, confirmed delete with records kept
    (RU).

Device checks: PENDING.
