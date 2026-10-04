import { useNetworkState } from 'expo-network';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { wifiOnlySupported } from './downloadQueue';
import { useOfflineStore } from './useOfflineStore';

/**
 * Feeds the download queue its runtime signals from the EXISTING network
 * source (expo-network, event-driven) and the app's foreground state.
 * Mounted once at the root. When the network becomes acceptable or the app
 * returns to the foreground, queued items resume on their own.
 */
export function useDownloadQueueRuntime() {
  const { isConnected, type } = useNetworkState();
  useEffect(() => {
    useOfflineStore.getState().setRuntime({ network: { isConnected, type }, wifiSupported: wifiOnlySupported(Platform.OS) });
  }, [isConnected, type]);
  useEffect(() => {
    useOfflineStore.getState().setRuntime({ appActive: AppState.currentState !== 'background' });
    const subscription = AppState.addEventListener('change', (state) => useOfflineStore.getState().setRuntime({ appActive: state === 'active' }));
    return () => subscription.remove();
  }, []);
}
