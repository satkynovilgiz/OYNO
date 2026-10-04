import { router, useLocalSearchParams } from 'expo-router';

import { GlossaryPracticeScreen } from '@/features/culture/glossary/practice/GlossaryPracticeScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** /culture/glossary/[id]/practice - Listen & Repeat for one term. */
export default function GlossaryPracticeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const termId = String(id ?? '');
  return <GlossaryPracticeScreen termId={termId} onPressBack={() => (router.canGoBack() ? router.back() : router.replace(`/culture/glossary/${termId}` as never))} />;
}
