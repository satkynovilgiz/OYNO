import { router } from 'expo-router';

import { DataPrivacyScreen } from '@/features/settings/dataPrivacy/DataPrivacyScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function DataPrivacyRoute() {
  return <DataPrivacyScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/settings/privacy' as never))} />;
}
