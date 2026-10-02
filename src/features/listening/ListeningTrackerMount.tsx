import { useEffect } from 'react';

import { installListeningTracker } from './listeningTracker';

/** Mounted once at the root: wires the listening history to the players. */
export function ListeningTracker() {
  useEffect(() => installListeningTracker(), []);
  return null;
}
