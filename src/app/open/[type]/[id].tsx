import { useLocalSearchParams } from 'expo-router';

import { ContentLinkScreen } from '@/services/links/ContentLinkScreen';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/system/RouteErrorBoundary';

/** oyno://open/<type>/<id> - validated before anything opens (see contentLinks.ts). */
export default function ContentLinkRoute() {
  const { type, id, via } = useLocalSearchParams<{ type?: string; id?: string; via?: string }>();
  return <ContentLinkScreen type={type} id={id} via={via} />;
}
