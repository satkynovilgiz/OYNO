# Follow the Connection (2026-10-07)

Route: `/culture/connections/trail?start=<id>[&type=culture_material]`.

- **Entries:** the "Follow the connections →" link in an article's
  Connections section, and "Follow the connections" on a connection's
  detail page.
- **Code:** `src/features/culture/connections/trailModel.ts` (pure) and
  `ConnectionTrailScreen.tsx`.

## Data: sourced only

The trail uses only `CULTURE_CONNECTIONS`, the 15 curated connections that
already exist.

- Each one quotes OYNO's own authored text (`evidence`, an exact excerpt
  of `source.field`, checked by `validateConnections`).
- No association is inferred or added.
- Links are read exactly as on articles (`linksFrom`, now shared with
  `connectionsFor`): outgoing links in curated order, then incoming links
  that allow reverse reading, using the reverse label ("Includes",
  "Used in"). `learn_next` has no way back.
- The person's own collections that contain the current object appear in a
  separate dashed box, "In your collections", labelled "Your own grouping -
  not a sourced connection". They are never trail links.

Because the data is small, so is the trail. That is the "smaller complete
trail" the spec allows: the boz üy, felt and ornament cluster, and the
horse cluster, which joins it through the oymo article.

## Rules

- Up to 3 links from the current object. Each shows:
  - the relation;
  - the destination;
  - the quoted explanation;
  - "Sourced link · From: <article> · <section>";
  - "Follow", and "Source", which opens the article that states the link.
- **No loops:** an object already on the trail is never offered again. The
  screen says how many links were left out for that reason. A unit test
  walks every possible trail from every start: each one ends, and none
  revisits a node.
- **Missing content:** a link whose destination article doesn't exist is
  listed as unavailable and can't be followed; the other links still work.
  A missing starting object gets its own message.
- **Retracing:**
  - Tap any step, in the Path or List view, to return to it.
  - "Back one step" and "Forward one step" are also available.
  - Later steps stay listed until you follow a new link from an earlier
    step, which replaces them, the way browser history does.
  - Opening an article pushes a screen on top. Coming back finds the trail
    intact.
  - The header Back button leaves the trail.
- **Local and ephemeral:** the trail is screen state for this visit. It is
  never stored or sent, and it adds no analytics event.
- **Offline:**
  - The trail needs the culture item list. If that has never been loaded,
    the standard offline screen appears with Retry.
  - "Read the article" is replaced by "Reading this article needs a
    connection" when that article isn't on the device.
- **Accessibility:**
  - Path (visual chain) and List (numbered, with relation labels) show the
    same steps; the toggle is a radio group.
  - Each step reads as "Step n of N: title, you are here".
  - Reduced motion: the path scrolls to the newest step without animation.
  - Large text in child mode.

## Tests

- **Unit (`trail.test.ts`):**
  - selection: at most 3 links, curated order, each one sourced;
  - reverse labels;
  - no loops, including the exhaustive walk;
  - dead end, then stepping back;
  - missing destination;
  - a link that wasn't offered is rejected;
  - retracing and replacing later steps;
  - groupings kept separate.
- **e2e (`connection-trail.spec.ts`):**
  - start from an article;
  - the unavailable (missing) node;
  - the Source link;
  - following a link, with no loop back;
  - opening the article and coming back keeps the trail;
  - returning to step 1, forward, back;
  - a new branch replaces later steps;
  - the List view;
  - dead end; missing start; KG/RU; axe in both views.

## Device checks: PENDING

- [ ] VoiceOver / TalkBack read the path steps and the link explanations in
  order.
- [ ] Android hardware Back from an article returns to the trail
  unchanged.

## Connection Quest (2026-10-08)

- **Route:** `/culture/connections/quest`. The entry is "Try a Connection
  Quest" on the trail screen.
- **Code:** `questModel.ts` (pure) and `ConnectionQuestScreen.tsx`.
- **Reused:** the connection dataset, `linksFrom` (directed links plus only
  the reverse readings the data allows), the trail model (`follow`,
  `trailOptions`, `goTo`) and the article resolver. No connection or
  explanation is invented; every option and every route step quotes its
  source.

### Rules

- **Generation:**
  - Breadth-first search over AVAILABLE content (`exists`) between every
    pair of objects with links.
  - A quest is offered only when a route of 2–4 links exists.
  - Shortest first, at most 6, up to two of each length from different
    starts.
  - With the full data the offer is 2, 2, 3, 3, 4, 4 links. With no
    reachable pair, it says so.
- **Every offered quest is solvable:** a unit test plays every one by
  following hints, under several sets of missing content, and arrives in
  exactly the quest's shortest number of links.
- **Play:**
  - The destination stays on screen throughout.
  - The current object comes with up to 3 sourced options; missing articles
    show as unavailable.
  - The route so far is a readable numbered list, and tapping a step returns
    to it.
  - Restart, or Choose another quest.
  - Sources open the article that states the link, and the quest is kept
    when you come back (memory slot).
- **Hint:** the first link of an actual shortest remaining route from where
  the player is. It avoids objects already on the trail, which the trail
  won't offer again.
- **Dead end:** "From here the destination can't be reached without going
  back", with "Go back to <the latest step that still has a route>", or, if
  none, "Start again from <start>".
- **Cycles:** routes never revisit an object, and the trail never offers
  one again.
- **Finish:** "You reached …", then the route, each link with its quoted
  evidence, source article and section, plus "nothing is scored or saved".
  No XP and no mastery.
- Offline with cached articles; KG/RU/EN; large text in child mode.

### Tests

- **Unit (`quest.test.ts`):**
  - directed links and reverse rules (the `learn_next` link is one-way);
  - every route link is a dataset connection;
  - shortest and bounded routes;
  - every offered quest solvable by its hints under four content sets;
  - none offered when nothing is reachable;
  - hints follow a real remaining route and are always on screen;
  - no cycles across all pairs;
  - missing objects are routed around or the quest isn't offered;
  - dead end, then recovery.
- **e2e (`connection-quest.spec.ts`):**
  - start → hint → read the source → return → follow to the destination,
    with the evidence shown on the route;
  - retrace, restart, RU, axe.
