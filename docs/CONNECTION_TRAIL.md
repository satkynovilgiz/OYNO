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
