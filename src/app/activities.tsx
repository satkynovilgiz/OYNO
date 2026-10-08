import { router } from 'expo-router';

import { ActivityChooserScreen } from '@/features/home/chooser/ActivityChooserScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function ActivitiesRoute() {
  return <ActivityChooserScreen onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/home' as never))} />;
}
