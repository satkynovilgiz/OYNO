import { useEffect } from 'react';

import { track } from './analytics';

/** Fires a `screen_view` event once when a screen mounts. Wired into the
 * main tab screens and content-detail routes - not exhaustively every
 * screen in the app, since that's a lot of individual wiring for
 * marginal value beyond the primary navigation funnel. */
export function useTrackScreenView(screenName: string) {
  useEffect(() => {
    track('screen_view', { screen: screenName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
