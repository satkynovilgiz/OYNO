import { router } from 'expo-router';
import { Link2Off } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { useAllCultureItems } from '@/services/content/cultureItemsService';
import { useCultureMaterials } from '@/services/content/cultureService';
import { colors, spacing, textStyles, typography } from '@/theme';

import { contentRoute, LINK_FALLBACK_ROUTE, parseContentLink } from './contentLinks';
import { resolveLink } from './resolveLink';

/**
 * /open/[type]/[id] - every shared content link lands here first. Unknown
 * query parameters are never read; the destination is built by
 * contentRoute(), so a link can't redirect anywhere else.
 */
export function ContentLinkScreen({ type, id }: { type: unknown; id: unknown }) {
  const { t } = useTranslation();
  const link = parseContentLink(type, id);
  const items = useAllCultureItems();
  const materials = useCultureMaterials();
  const resolution = resolveLink(link, {
    items: link?.type === 'culture_item' ? items.data : undefined,
    materials: link?.type === 'culture_material' ? materials.data : undefined,
    itemsSettled: items.fetchStatus === 'idle',
    materialsSettled: materials.fetchStatus === 'idle',
  });
  const opened = useRef(false);

  useEffect(() => {
    if (resolution !== 'open' || !link || opened.current) return;
    opened.current = true;
    track('content_link_opened', { content_type: link.type, content_id: link.id });
    router.replace(contentRoute(link) as never);
  }, [resolution, link]);

  if (resolution === 'invalid') {
    return (
      <View style={styles.root}>
        <Link2Off size={28} color={colors.textMuted} strokeWidth={1.8} />
        <Text style={styles.title} accessibilityRole="header">
          {t('contentLinks.invalidTitle')}
        </Text>
        <Text style={styles.body}>{t('contentLinks.invalidBody')}</Text>
        <Button label={t('contentLinks.goHome')} onPress={() => router.replace(LINK_FALLBACK_ROUTE as never)} />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.primary} accessibilityLabel={t('contentLinks.opening')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  body: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center' },
});
