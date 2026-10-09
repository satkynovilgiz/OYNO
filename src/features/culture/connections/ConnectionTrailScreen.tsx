import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, Button, IconButton, MediaImage } from '@/components/ui';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { myCollectionRoute } from '@/features/myCollections/MyCollectionsScreen';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { ownerCollections, useMyCollectionsStore } from '@/store/useMyCollectionsStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { contentRoute, type ConnectionContentType } from './connectionsData';
import type { ArticleConnection } from './connectionsModel';
import { backOne, currentNode, follow, forwardOne, goTo, groupingsFor, startTrail, trailOptions, type TrailState } from './trailModel';
import { useConnectionContent } from './useConnectionContent';

/** Field -> existing article section label (same as the connection detail). */
const FIELD_LABEL: Record<string, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  objects_used: 'culture.item.objectsUsedLabel',
};

/**
 * /culture/connections/trail?start=<id>[&type=culture_material] - follow
 * SOURCED connections from object to object (trailModel.ts has the rules).
 * The trail is this screen's own state: opening an article and coming back
 * keeps it; leaving the screen ends it. Path and List show the same trail.
 */
export function ConnectionTrailScreen({ startType, startId, onPressBack }: { startType: ConnectionContentType; startId: string; onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const { isOffline } = useNetworkStatus();
  const content = useConnectionContent();
  const owner = useRecordsOwner();
  const collections = useMyCollectionsStore((state) => ownerCollections(state.saved, owner));
  const [trail, setTrail] = useState<TrailState>(() => startTrail({ type: startType, id: startId }));
  const [view, setView] = useState<'path' | 'list'>('path');
  const pathScroll = useRef<ScrollView>(null);

  useEffect(() => {
    void useMyCollectionsStore.getState().load();
  }, []);
  useEffect(() => {
    pathScroll.current?.scrollToEnd({ animated: !reducedMotion });
  }, [trail.steps.length, reducedMotion]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
        {t('culture.connections.trail.title')}
      </Text>
    </View>
  );

  if (content.waitingForNetwork) return <OfflineUnavailable onRetry={content.retry} />;
  if (content.isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const start = content.get(startType, startId);
  if (!start) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.content}>
          <Text style={styles.body} testID="trail-missing-start">
            {t('culture.connections.trail.missingStart')}
          </Text>
          <Button label={t('culture.connections.trail.explore')} variant="secondary" onPress={() => router.replace('/culture' as never)} />
        </View>
      </View>
    );
  }

  const node = currentNode(trail);
  const here = content.get(node.type, node.id);
  const options = trailOptions(trail, content.exists);
  const titleOf = (type: ConnectionContentType, id: string) => content.get(type, id)?.title ?? id;
  const relation = (entry: ArticleConnection) => t(`culture.connections.relation.${entry.labelKey}`);
  const hereRoute = contentRoute(node.type, node.id);
  const readable = !isOffline || isRouteAvailableOffline(hereRoute, queryClient);
  const groupings = groupingsFor(collections, node);
  const total = trail.steps.length;
  const stepLabel = (index: number) =>
    t('culture.connections.trail.stepA11y', { n: index + 1, total, title: titleOf(trail.steps[index].node.type, trail.steps[index].node.id), current: index === trail.current ? t('culture.connections.trail.currentSuffix') : '' });

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.meta}>{t('culture.connections.trail.intro')}</Text>
        <Button label={t('culture.connections.quest.entry')} variant="text" onPress={() => router.push('/culture/connections/quest' as never)} testID="quest-entry" />

        {/* The trail: a path of steps, or the same steps as a list. */}
        <View style={styles.rowBetween}>
          <Text style={styles.section} accessibilityRole="header">
            {t('culture.connections.trail.trailTitle')}
          </Text>
          <View style={styles.toggle} accessibilityRole="radiogroup" accessibilityLabel={t('culture.connections.trail.view')}>
            {(['path', 'list'] as const).map((option) => (
              <AnimatedPressable key={option} style={[styles.toggleItem, view === option && styles.toggleOn]} onPress={() => setView(option)} accessibilityRole="radio" accessibilityState={{ checked: view === option }} aria-checked={view === option} accessibilityLabel={t(`culture.connections.trail.views.${option}`)} testID={`trail-view-${option}`}>
                <Text style={[styles.toggleText, view === option && styles.toggleTextOn]}>{t(`culture.connections.trail.views.${option}`)}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>

        {view === 'path' ? (
          <ScrollView ref={pathScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.path} testID="trail-path">
            {trail.steps.map((step, index) => {
              const target = content.get(step.node.type, step.node.id);
              const on = index === trail.current;
              return (
                <View key={`${index}-${step.node.id}`} style={styles.pathStep}>
                  {index > 0 ? <ArrowRight size={16} color={index <= trail.current ? colors.accentTerracotta : colors.textMuted} /> : null}
                  <AnimatedPressable style={[styles.node, on && styles.nodeOn, index > trail.current && styles.nodeAhead]} onPress={() => setTrail((state) => goTo(state, index))} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={stepLabel(index)} testID={`trail-step-${index}`}>
                    <View style={styles.nodeImage}>{target?.image ? <MediaImage source={target.image as never} /> : <OymoOrnament size={20} color={colors.accentGoldPressed} strokeWidth={1.5} />}</View>
                    <Text style={styles.nodeTitle} numberOfLines={2}>
                      {target?.title ?? step.node.id}
                    </Text>
                  </AnimatedPressable>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.list} testID="trail-list">
            {trail.steps.map((step, index) => (
              <AnimatedPressable key={`${index}-${step.node.id}`} style={[styles.listRow, index === trail.current && styles.listRowOn]} onPress={() => setTrail((state) => goTo(state, index))} accessibilityRole="button" accessibilityState={{ selected: index === trail.current }} accessibilityLabel={stepLabel(index)} testID={`trail-step-${index}`}>
                <Text style={styles.listNumber}>{index + 1}.</Text>
                <View style={styles.flex}>
                  {step.via ? <Text style={styles.meta}>{relation(step.via)}</Text> : null}
                  <Text style={[styles.body, index === trail.current && styles.bold]}>{titleOf(step.node.type, step.node.id)}</Text>
                </View>
                {index === trail.current ? <Text style={styles.hereTag}>{t('culture.connections.trail.here')}</Text> : null}
              </AnimatedPressable>
            ))}
          </View>
        )}

        <View style={styles.stepButtons}>
          {trail.current > 0 ? <Button label={t('culture.connections.trail.back')} variant="secondary" onPress={() => setTrail(backOne)} testID="trail-back" /> : null}
          {trail.current < trail.steps.length - 1 ? <Button label={t('culture.connections.trail.forward')} variant="text" onPress={() => setTrail(forwardOne)} testID="trail-forward" /> : null}
        </View>

        {/* Where you are. */}
        <View style={styles.hereCard} testID="trail-here">
          <Text style={styles.meta}>{t('culture.connections.trail.here')}</Text>
          <Text style={[styles.title, large && styles.titleLarge]} accessibilityRole="header">
            {here?.title ?? node.id}
          </Text>
          {readable ? <Button label={t('culture.connections.trail.openArticle')} variant="secondary" onPress={() => router.push(hereRoute as never)} testID="trail-open-article" /> : <Text style={styles.meta}>{t('culture.connections.trail.needsConnection')}</Text>}
        </View>

        <Text style={styles.section} accessibilityRole="header">
          {t('culture.connections.trail.nextTitle')}
        </Text>
        {options.next.map((entry) => {
          const title = titleOf(entry.otherType, entry.otherId);
          const source = content.get(entry.connection.source.contentType, entry.connection.source.contentId);
          const section = FIELD_LABEL[entry.connection.source.field] ? t(FIELD_LABEL[entry.connection.source.field]) : entry.connection.source.field;
          return (
            <View key={`${entry.connection.id}-${entry.otherId}`} style={styles.option} testID={`trail-option-${entry.otherId}`}>
              <Text style={styles.relation}>{relation(entry)}</Text>
              <Text style={[styles.optionTitle, large && styles.titleLarge]}>{title}</Text>
              <Text style={styles.quote}>“{entry.connection.evidence}”</Text>
              <Text style={styles.meta}>
                {t('culture.connections.trail.sourced')} · {t('culture.connections.fromArticle', { title: source?.title ?? entry.connection.source.contentId, section })}
              </Text>
              <View style={styles.optionButtons}>
                <Button label={t('culture.connections.trail.follow', { title })} onPress={() => setTrail((state) => follow(state, entry, content.exists))} testID={`trail-follow-${entry.otherId}`} />
                <Button
                  label={t('culture.connections.trail.source')}
                  variant="text"
                  onPress={() => router.push(contentRoute(entry.connection.source.contentType, entry.connection.source.contentId) as never)}
                  accessibilityHint={t('culture.connections.trail.sourceA11y', { title: source?.title ?? entry.connection.source.contentId })}
                  testID={`trail-source-${entry.otherId}`}
                />
              </View>
            </View>
          );
        })}
        {options.unavailable.map((entry) => (
          <Text key={`missing-${entry.connection.id}`} style={styles.meta} testID={`trail-unavailable-${entry.otherId}`}>
            {t('culture.connections.trail.unavailable', { relation: relation(entry) })}
          </Text>
        ))}
        {options.visited > 0 ? <Text style={styles.meta}>{t('culture.connections.trail.visitedNote', { count: options.visited })}</Text> : null}
        {options.next.length === 0 ? (
          <Text style={styles.body} testID="trail-dead-end">
            {t('culture.connections.trail.deadEnd')}
          </Text>
        ) : null}

        {/* The person's own collections: shown apart, never as a sourced link. */}
        {groupings.length > 0 ? (
          <View style={styles.groupings} testID="trail-groupings">
            <Text style={styles.section}>{t('culture.connections.trail.yourGroupings')}</Text>
            <Text style={styles.meta}>{t('culture.connections.trail.yourGroupingsNote')}</Text>
            {groupings.map((collection) => (
              <Button key={collection.id} label={collection.name} variant="text" onPress={() => router.push(myCollectionRoute(collection.id) as never)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  section: { ...typography.overline, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bold: { fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  title: { ...textStyles.h2, color: colors.textPrimary },
  titleLarge: { fontSize: 24, lineHeight: 32 },
  toggle: { flexDirection: 'row', gap: 4 },
  toggleItem: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  toggleTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  path: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  pathStep: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  node: { width: 96, minHeight: 96, gap: 4, padding: 6, alignItems: 'center', borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  nodeOn: { borderColor: colors.primary, borderWidth: 2 },
  nodeAhead: { borderStyle: 'dashed' },
  nodeImage: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  nodeTitle: { ...textStyles.small, color: colors.textPrimary, textAlign: 'center' },
  list: { gap: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  listRowOn: { borderWidth: 2, borderColor: colors.primary },
  listNumber: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textSecondary, width: 24 },
  hereTag: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  stepButtons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  hereCard: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  option: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  relation: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  optionTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  quote: { ...textStyles.body, color: colors.textPrimary, fontStyle: 'italic' },
  optionButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  groupings: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSubtle },
});
