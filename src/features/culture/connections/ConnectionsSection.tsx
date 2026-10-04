import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, MediaImage } from '@/components/ui';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { track } from '@/services/analytics/analytics';
import type { AgeExperience } from '@/services/ageExperience/types';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import { connectionRoute, contentRoute, type ConnectionContentType } from './connectionsData';
import { connectionsFor, type ArticleConnection } from './connectionsModel';
import { useConnectionContent, type ConnectionTarget } from './useConnectionContent';

export function openConnection(entry: ArticleConnection, fromId: string) {
  track('culture_connection_opened', { connection_id: entry.connection.id, from_id: fromId, to_id: entry.otherId });
  router.push(contentRoute(entry.otherType, entry.otherId) as never);
}

/**
 * "Connections" on an article: 2-5 curated relationships (connectionsData)
 * as cards - relation label, destination title, its existing image and a
 * short type. Nothing when the article has fewer than two.
 *   child    image-first tiles
 *   preteen  image + a visual relation pill
 *   teen / adult  editorial rows (text-led, small thumbnail)
 */
export function ConnectionsSection({ type, id, experience }: { type: ConnectionContentType; id: string; experience: AgeExperience }) {
  const { t } = useTranslation();
  const content = useConnectionContent();
  const entries = connectionsFor(type, id, content.exists);
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {t('culture.connections.title')}
      </Text>
      <View style={experience === 'child' ? styles.grid : styles.list}>
        {/* Child tiles: two per row. */}
        {entries.map((entry) => {
          const target = content.get(entry.otherType, entry.otherId);
          if (!target) return null;
          return (
            <View key={entry.connection.id} style={[styles.item, experience === 'child' && styles.itemChild]}>
              <ConnectionCard entry={entry} target={target} experience={experience} onPress={() => openConnection(entry, id)} />
              {experience === 'child' ? null : (
                <AnimatedPressable style={styles.why} onPress={() => router.push(connectionRoute(entry.connection.id) as never)} hitSlop={6} accessibilityRole="link" accessibilityLabel={t('culture.connections.whyA11y', { title: target.title })}>
                  <Text style={styles.whyText}>{t('culture.connections.why')}</Text>
                </AnimatedPressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ConnectionCard({ entry, target, experience, onPress }: { entry: ArticleConnection; target: ConnectionTarget; experience: AgeExperience; onPress: () => void }) {
  const { t } = useTranslation();
  const relation = t(`culture.connections.relation.${entry.labelKey}`);
  const typeLabel = t(`saved.contentTypes.${target.type}`);
  const label = t('culture.connections.cardA11y', { relation, title: target.title, type: typeLabel });
  const image = (
    <View style={experience === 'child' ? styles.childImage : experience === 'preteen' ? styles.preteenImage : styles.thumb}>
      {target.image ? <MediaImage source={target.image as never} /> : <OymoOrnament size={28} color={colors.accentGoldPressed} strokeWidth={1.5} />}
    </View>
  );
  if (experience === 'child') {
    return (
      <AnimatedPressable style={styles.childCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {image}
        <Text style={styles.childTitle} numberOfLines={2}>
          {target.title}
        </Text>
      </AnimatedPressable>
    );
  }
  if (experience === 'preteen') {
    return (
      <AnimatedPressable style={styles.preteenCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        {image}
        <View style={styles.text}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{relation}</Text>
            <ArrowRight size={12} color={colors.primary} strokeWidth={2.5} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {target.title}
          </Text>
        </View>
      </AnimatedPressable>
    );
  }
  return (
    <AnimatedPressable style={styles.row} onPress={onPress} press="soft" accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.text}>
        <Text style={styles.relation}>{relation}</Text>
        <Text style={[styles.cardTitle, experience === 'adult' && styles.editorialTitle]} numberOfLines={2}>
          {target.title}
        </Text>
        <Text style={styles.type}>{typeLabel}</Text>
      </View>
      {image}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  item: { gap: 2 },
  itemChild: { width: '47%' },
  why: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  whyText: { ...textStyles.small, fontWeight: '600', color: colors.primary, textDecorationLine: 'underline' },
  title: { ...textStyles.overline, color: colors.accentTerracotta },
  list: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  text: { flex: 1, gap: 2, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.borderSubtle },
  relation: { ...textStyles.overline, color: colors.textSecondary },
  cardTitle: { ...textStyles.title, fontSize: 17, color: colors.textPrimary },
  editorialTitle: { ...editorial(textStyles.title) },
  type: { ...textStyles.small, color: colors.textMuted },
  thumb: { width: 56, height: 56, borderRadius: cardRadii.compact, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  preteenCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  preteenImage: { width: 72, height: 72, borderRadius: cardRadii.compact, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: cardRadii.chip, backgroundColor: colors.surfaceMuted },
  pillText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  childCard: { gap: spacing.xs },
  childImage: { width: '100%', aspectRatio: 1, borderRadius: cardRadii.media, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  childTitle: { ...textStyles.title, fontSize: 18, color: colors.textPrimary },
});
