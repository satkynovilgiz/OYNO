import { useEffect } from 'react';

import { useWidgetSnapshot } from '@/features/appearance/useWidgetSnapshot';
import { publishWidgetSnapshot } from '@/services/widgets/widgetBridge';

/**
 * Keeps the native iOS widget's PUBLIC snapshot current. Renders nothing;
 * mounted once (iOS only) in the root layout. The snapshot comes from the
 * same hook the in-app Widget Gallery uses, so the widgets and the gallery
 * always agree. Only public content is ever written (see publicWidgetSnapshot.ts).
 */
export function WidgetSync() {
  const snapshot = useWidgetSnapshot();
  useEffect(() => {
    publishWidgetSnapshot(snapshot);
  }, [snapshot]);
  return null;
}
