import { router } from 'expo-router';

import { ImportBackupScreen } from '@/features/settings/dataPrivacy/ImportBackupScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ImportBackupRoute() {
  return <ImportBackupScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/settings/data-privacy' as never))} />;
}
