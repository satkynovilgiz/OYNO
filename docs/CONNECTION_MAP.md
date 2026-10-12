# Connection Map

- **Entry:** "See the connection map" in an article's Connections section.
- **Route:** `/culture/connections/map?start=<id>[&type=culture_material]`.
- **Code:** `src/features/culture/connections/connectionMapModel.ts`, `ConnectionMapScreen.tsx`
  and `ConnectionEvidence.tsx`. The evidence block is now shared with the connection detail
  screen.

## Rules

- **Edges:** only entries of the existing `CULTURE_CONNECTIONS` dataset, by id. Traversal uses
  `linksFrom`, the article's own rule: outgoing links, plus incoming ones only where the dataset
  allows a reverse reading. A one-way relation such as `learn_next` is never followed backwards.
- **Direction:** every arrow points the dataset's way (from → to). A permitted reverse reading
  is named ("can also be read: Includes"). One-way connections are drawn dashed and labelled.
- **Bounded:** the start and its neighbours open automatically, so two hops are visible, with at
  most **12 objects**. Deeper nodes open only with **Expand**. Objects beyond the limit are
  counted ("N more not shown"), not drawn. Nodes and edges are de-duplicated by key and id, so
  cycles never expand twice.
- **Unavailable objects:** a node whose article isn't available is shown dashed and labelled
  "Not available". It is never expanded or replaced.
- **Evidence:** selecting a connection shows the shared `ConnectionEvidence` block (the exact
  excerpt and its article section), plus "Open the source section". When the source article is
  unavailable, the screen says so.
- **The list:** "All connections shown" lists the same edges and evidence as the map, and selects
  them. "Objects on the map" lists the nodes with their Expand controls. The map picture is a
  labelled, focusable region pointing to the list.
- **Return:** expanded nodes, the selected connection, zoom and horizontal scroll are kept in
  memory per start article, and restored after returning from a source.
- **Kept out:** personal notes are never part of the graph. There is no animation, so reduced
  motion needs nothing extra.
- **Offline:** titles and availability come from the cached article and material lists, and the
  dataset is bundled.

## Tests

- `connectionMap.test.ts`:
  - every edge is a real entry in its dataset direction, with the reverse label only when
    permitted;
  - two hops, then explicit expansion;
  - one-way relations not followed backwards;
  - cycles not repeated;
  - the node limit, with hidden objects counted;
  - unavailable nodes;
  - deterministic layout;
  - view memory.
- `connections.test.ts`: the evidence block is shared by the detail screen and the map.
- `e2e/tests/connection-map.spec.ts`:
  - article → map → expand → zoom → select a connection (evidence) → open the source section →
    back, with the same selection, expansion and zoom;
  - the list count equals the map count (RU).

Device checks: PENDING.
