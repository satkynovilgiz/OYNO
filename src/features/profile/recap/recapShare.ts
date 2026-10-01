import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

import { SHAREABLE_METRICS, type OYNORecap } from './recapModel';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The 4:5 recap card (the existing ShareCard "story" layout): OYNO
 * branding, "My OYNO story", and only public-style counts. Never journal
 * text, saved item names, email, ids, notes, feedback, downloads or admin
 * status - those values are not even inputs here.
 */
export function buildRecapShareCard(recap: Pick<OYNORecap, 'metrics'>, t: Translate): ShareCardContent {
  const line = recap.metrics
    .filter((metric) => SHAREABLE_METRICS.includes(metric.id))
    .map((metric) => t(`recap.metric.${metric.id}`, { count: metric.value }))
    .join(' · ');
  return { title: t('recap.storyTitle'), label: t('recap.allTime'), subtitle: line || null, imageSource: null, fallbackTone: colors.primary };
}
