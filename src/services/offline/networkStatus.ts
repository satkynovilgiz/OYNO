import { onlineManager } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';

/**
 * The one network-status source: expo-network (native connectivity events
 * on device, navigator.onLine on web) - the same signal already wired into
 * react-query's onlineManager in services/queryClient.ts, so screens,
 * queries and downloads all agree. Event-driven, no polling.
 * `isConnected === undefined` (not known yet, e.g. at boot) counts as
 * online so a slow first read never flashes "offline".
 */
export function useNetworkStatus(): { isOffline: boolean } {
  const { isConnected } = useNetworkState();
  return { isOffline: isConnected === false };
}

export function isOfflineNow(): boolean {
  return !onlineManager.isOnline();
}

/** Calls `callback` each time connectivity comes back after being lost. */
export function onConnectionRestored(callback: () => void): () => void {
  let wasOnline = onlineManager.isOnline();
  return onlineManager.subscribe((isOnline) => {
    if (isOnline && !wasOnline) callback();
    wasOnline = isOnline;
  });
}
