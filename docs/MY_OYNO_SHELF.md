# My OYNO Shelf

Profile -> **My OYNO Shelf** (`/profile/shelf`). One list over existing
records; nothing is copied or stored by the shelf.

## Sources (`shelfModel.ts` adapters)

| Type | Source of truth | Opens | Storage label |
| --- | --- | --- | --- |
| Oymo designs | `oymo_creations` (Supabase, RLS: own rows) | `/culture/oymo/create?creation=<id>` (new param: loads that design once) | Saved to your account |
| Exhibitions | `useMyCollectionsStore` museums + collections (a collection with a saved exhibition) | `/profile/my-collections/museum?collection=<id>` | On this device only |
| Discovery boards | `useDiscoveryBoardStore` | `/culture/board/<id>` | On this device only |
| Time capsules | `useCapsuleStore` | `/profile/capsules/<id>` | On this device only |

**Sealed capsules:** the adapter outputs only the title, the sealed state
and the opening date. The message, articles and design are never read
into a shelf item, so they can't appear in the list, the accessibility
labels or search results.

## Filter, search, sort (`shelfView`)

- **Filter:** All or one type.
- **Search:** titles only; case- and diacritics-insensitive. Untitled
  items match only an empty search.
- **Sort:** recently changed / recently made / title A-Z.
  - Missing dates always sort last.
  - Ties fall back to title, then a stable key.
  - Missing titles show "Untitled …" and sort last by title.

## Ownership and states

- Every source reads only the current owner's records.
- Saved designs use their own **owner-keyed** query
  (`['oymo_creations', 'shelf', owner]`), so after an account switch a
  previous account's cached list is never shown. Switching account
  re-renders with the new owner immediately.
- Each source has its own state:
  - loading;
  - ready;
  - error, with Retry (the others stay visible; never shown as "empty");
  - unavailable (designs for a guest: "saved to your account - sign in").
- Empty categories link to their existing creation flows. No deletion
  across types in this version; delete in each item's own screen.

## Tests

- `shelf/shelf.test.ts`:
  - adapters (routes, storage labels, a collection without its record is
    dropped);
  - a sealed capsule item contains no message and its words aren't
    searchable;
  - sort with missing dates and titles; diacritics-insensitive search;
    type filter;
  - screen: a failing board source shows an error while designs and
    capsules stay; an account switch empties immediately; a guest sees
    designs as unavailable, not empty.
- `e2e/tests/shelf.spec.ts`:
  - exhibition, board and sealed capsule: order by change date; storage
    labels; designs unavailable for a guest; axe;
  - title search, and that the sealed message isn't searchable; filter;
  - each item opens its existing screen;
  - RU: empty states link to creation.

Not e2e-tested: saved designs (the e2e backend has no sign-in) and the
Creator's new `?creation=` param. Both are covered only by the adapter
unit test.
