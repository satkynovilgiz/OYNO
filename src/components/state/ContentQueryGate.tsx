import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { NotFoundState } from '@/components/system/NotFoundState';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isWaitingForNetwork } from '@/services/offline/offlineManifest';

import { ArticleSkeleton, LoadingState, StateMessage, StateScreen } from './ScreenState';
import { resolveScreenState } from './stateRules';

type Query<T> = { data: T | null | undefined; isLoading: boolean; error: unknown; fetchStatus: string; refetch: () => unknown };

/**
 * The states of a long-form content route (article, material) before the
 * content can show: offline and not downloaded / loading (article-shaped
 * skeleton) / failed (Try again) / not found - each different, each with
 * its own way forward. Cached content shows even when a refresh fails.
 */
export function ContentQueryGate<T>({ query, fallbackRoute, loadingLabel, errorTitle, children }: { query: Query<T>; fallbackRoute: string; loadingLabel: string; errorTitle: string; children: (data: T) => ReactNode }) {
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallbackRoute as never));
  const retry = () => void query.refetch();
  const state = resolveScreenState({
    hasContent: !!query.data,
    unavailable: isWaitingForNetwork(query),
    failed: !!query.error,
    loading: query.isLoading,
    missing: !query.isLoading && !query.error && !query.data,
  });

  if (state === 'ready' && query.data) return <>{children(query.data)}</>;
  if (state === 'notFound') return <NotFoundState onPressBack={back} />;
  return (
    <StateScreen onPressBack={back} testID={`content-state-${state}`} align={state === 'loading' ? 'top' : 'center'}>
      {state === 'loading' ? (
        <LoadingState label={loadingLabel} skeleton={<ArticleSkeleton />} onRetry={retry} />
      ) : state === 'unavailable' ? (
        <StateMessage
          kind="unavailable"
          title={t('offline.notAvailable')}
          body={isOffline ? t('states.offlineBody') : t('states.reconnectedBody')}
          action={isOffline ? { label: t('states.openDownloads'), onPress: () => router.push('/offline' as never), testID: 'state-open-downloads' } : { label: t('common.retry'), onPress: retry, testID: 'state-retry' }}
          secondary={{ label: t('common.back'), onPress: back }}
        />
      ) : (
        <StateMessage kind="error" title={errorTitle} body={t('states.errorBody')} action={{ label: t('common.retry'), onPress: retry, testID: 'state-retry' }} secondary={{ label: t('common.back'), onPress: back }} />
      )}
    </StateScreen>
  );
}
