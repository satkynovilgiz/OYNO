import { onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

/**
 * No screen calls useQuery/useMutation yet (no backend is wired up - see
 * PROGRESS_AUDIT.md), so this has nothing to pause/resume today. It's real,
 * working sync infrastructure ready for when queries exist: react-query
 * will correctly pause in-flight/scheduled queries while offline and
 * refetch on reconnect, driven by the same connectivity signal as
 * OfflineBanner, instead of the default (and wrong, for a mobile app)
 * browser-only `navigator.onLine` check react-query ships with.
 */
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(state.isConnected ?? true);
  });
  return () => subscription.remove();
});
