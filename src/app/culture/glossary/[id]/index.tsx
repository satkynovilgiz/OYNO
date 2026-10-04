import { router, useLocalSearchParams } from 'expo-router';

import { GlossaryTermScreen } from '@/features/culture/glossary/GlossaryTermScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function GlossaryTermRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GlossaryTermScreen termId={String(id ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/glossary' as never))} />;
}
