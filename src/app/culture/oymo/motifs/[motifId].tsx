import { router, useLocalSearchParams } from 'expo-router';

import { CustomMotifEditorScreen } from '@/features/culture/oymo/customMotif/CustomMotifScreens';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

export default function CustomMotifEditorRoute() {
  const { motifId } = useLocalSearchParams<{ motifId: string }>();
  return <CustomMotifEditorScreen key={String(motifId)} motifId={String(motifId ?? '')} onPressBack={() => (router.canGoBack() ? router.back() : router.replace('/culture/oymo/motifs' as never))} />;
}
