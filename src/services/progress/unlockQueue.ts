/** Unlock modal queue: new ids are appended once (never duplicated, never
 * re-adding one already waiting). An empty/undefined `newlyUnlocked` - e.g.
 * loading an account's existing progress - adds nothing. */
export function enqueueUnlocks<T extends string>(queue: T[], newlyUnlocked: T[] | undefined): T[] {
  if (!newlyUnlocked?.length) return queue;
  return [...queue, ...newlyUnlocked.filter((id) => !queue.includes(id))];
}
