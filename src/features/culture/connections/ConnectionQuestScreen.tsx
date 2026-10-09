import { router } from 'expo-router';
import { ChevronLeft, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineUnavailable } from '@/components/offline/OfflineUnavailable';
import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { contentRoute } from './connectionsData';
import type { ArticleConnection } from './connectionsModel';
import { generateQuests, hintFor, keepQuest, questStatus, recoveryStep, resumeQuest, routeOf, type Quest } from './questModel';
import { currentNode, follow, goTo, startTrail, trailOptions, type TrailState } from './trailModel';
import { useConnectionContent } from './useConnectionContent';

const FIELD_LABEL: Record<string, string> = {
  origin: 'culture.item.originLabel',
  history: 'culture.item.historyLabel',
  cultural_meaning: 'culture.item.culturalMeaningLabel',
  traditional_method: 'culture.item.traditionalMethodLabel',
  objects_used: 'culture.item.objectsUsedLabel',
};

/**
 * /culture/connections/quest - Connection Quest (questModel.ts): reach the
 * destination by following sourced connections. The destination is always
 * on screen; hints and dead-end recovery come from a real remaining route.
 * The attempt is ephemeral (memory only, kept while sources are opened).
 */
export function ConnectionQuestScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const content = useConnectionContent();
  const [active, setActiveState] = useState(() => resumeQuest());
  const [showHint, setShowHint] = useState(false);
  const setActive = (next: { quest: Quest; state: TrailState } | null) => {
    keepQuest(next);
    setActiveState(next);
    setShowHint(false);
  };
  const titleOf = (type: 'culture_item' | 'culture_material', id: string) => content.get(type, id)?.title ?? id;
  const relation = (entry: ArticleConnection) => t(`culture.connections.relation.${entry.labelKey}`);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {t('culture.connections.quest.title')}
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

  // Choose a quest: only solvable ones, shortest first.
  if (!active) {
    const quests = generateQuests(content.exists);
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="quest-pick">
          <Text style={[styles.body, large && styles.bodyLarge]}>{t('culture.connections.quest.intro')}</Text>
          <Text style={styles.section} accessibilityRole="header">
            {t('culture.connections.quest.pickTitle')}
          </Text>
          {quests.length === 0 ? <Text style={styles.body}>{t('culture.connections.quest.none')}</Text> : null}
          {quests.map((quest) => (
            <AnimatedPressable
              key={quest.id}
              style={styles.questCard}
              onPress={() => setActive({ quest, state: startTrail(quest.start) })}
              accessibilityRole="button"
              accessibilityLabel={t('culture.connections.quest.questA11y', { start: titleOf(quest.start.type, quest.start.id), destination: titleOf(quest.destination.type, quest.destination.id), count: quest.steps })}
              testID={`quest-${quest.id}`}
            >
              <Text style={styles.bodyBold}>
                {titleOf(quest.start.type, quest.start.id)} → {titleOf(quest.destination.type, quest.destination.id)}
              </Text>
              <Text style={styles.meta}>{t('culture.connections.quest.best', { count: quest.steps })}</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  const { quest, state } = active;
  const node = currentNode(state);
  const status = questStatus(state, quest, content.exists);
  const options = trailOptions(state, content.exists);
  const hint = status === 'going' ? hintFor(state, quest, content.exists) : null;
  const recovery = status === 'deadEnd' ? recoveryStep(state, quest, content.exists) : null;
  const destinationTitle = titleOf(quest.destination.type, quest.destination.id);
  const apply = (next: TrailState) => {
    setActive({ quest, state: next });
    if (questStatus(next, quest, content.exists) === 'arrived') announce(t('culture.connections.quest.arrivedTitle', { title: destinationTitle }));
  };

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} testID="quest-play">
        {/* The destination stays in view the whole time. */}
        <View style={styles.destination} accessible accessibilityLabel={`${t('culture.connections.quest.destination')}: ${destinationTitle}`} testID="quest-destination">
          <Flag size={18} color={colors.accentTerracotta} />
          <View style={styles.flex}>
            <Text style={styles.section}>{t('culture.connections.quest.destination')}</Text>
            <Text style={[styles.bodyBold, large && styles.bodyLarge]}>{destinationTitle}</Text>
          </View>
        </View>

        {/* The route so far, as a readable list (tap a step to go back to it). */}
        <Text style={styles.section} accessibilityRole="header">
          {t('culture.connections.quest.trailTitle')} · {t('culture.connections.quest.steps', { count: state.current })}
        </Text>
        <View style={styles.list} testID="quest-steps">
          {state.steps.map((step, index) => (
            <AnimatedPressable key={`${index}-${step.node.id}`} style={[styles.listRow, index === state.current && styles.listRowOn]} onPress={() => apply(goTo(state, index))} accessibilityRole="button" accessibilityState={{ selected: index === state.current }} accessibilityLabel={`${index + 1}. ${step.via ? `${relation(step.via)}: ` : ''}${titleOf(step.node.type, step.node.id)}`} testID={`quest-step-${index}`}>
              <Text style={styles.listNumber}>{index + 1}.</Text>
              <View style={styles.flex}>
                {step.via ? <Text style={styles.meta}>{relation(step.via)}</Text> : null}
                <Text style={[styles.body, index === state.current && styles.bold]}>{titleOf(step.node.type, step.node.id)}</Text>
              </View>
              {index === state.current ? <Text style={styles.hereTag}>{t('culture.connections.quest.here')}</Text> : null}
            </AnimatedPressable>
          ))}
        </View>

        {status === 'arrived' ? (
          <View style={styles.stack} testID="quest-arrived">
            <Text style={styles.heading} accessibilityRole="header">
              {t('culture.connections.quest.arrivedTitle', { title: destinationTitle })}
            </Text>
            <Text style={styles.section}>{t('culture.connections.quest.routeTitle')}</Text>
            {routeOf(state).map((entry, index) => {
              const fromNode = state.steps[index].node;
              const source = content.get(entry.connection.source.contentType, entry.connection.source.contentId);
              return (
                <View key={`${entry.connection.id}-${index}`} style={styles.evidence} testID={`quest-route-${index}`}>
                  <Text style={styles.bodyBold}>{t('culture.connections.quest.routeStep', { from: titleOf(fromNode.type, fromNode.id), relation: relation(entry), to: titleOf(entry.otherType, entry.otherId) })}</Text>
                  <Text style={styles.quote}>“{entry.connection.evidence}”</Text>
                  <Text style={styles.meta}>{t('culture.connections.fromArticle', { title: source?.title ?? entry.connection.source.contentId, section: FIELD_LABEL[entry.connection.source.field] ? t(FIELD_LABEL[entry.connection.source.field]) : entry.connection.source.field })}</Text>
                  <Button label={t('culture.connections.trail.source')} variant="text" onPress={() => router.push(contentRoute(entry.connection.source.contentType, entry.connection.source.contentId) as never)} testID={`quest-route-source-${index}`} />
                </View>
              );
            })}
            <Text style={styles.meta}>{t('culture.connections.quest.noMastery')}</Text>
            <Button label={t('culture.connections.quest.otherQuest')} onPress={() => setActive(null)} testID="quest-other" />
          </View>
        ) : (
          <>
            <View style={styles.here} testID="quest-here">
              <Text style={styles.meta}>{t('culture.connections.quest.here')}</Text>
              <Text style={[styles.heading, large && styles.bodyLarge]}>{titleOf(node.type, node.id)}</Text>
              <Button label={t('culture.connections.trail.openArticle')} variant="text" onPress={() => router.push(contentRoute(node.type, node.id) as never)} testID="quest-open-article" />
            </View>
            {status === 'deadEnd' ? (
              <View style={styles.deadEnd} testID="quest-dead-end">
                <Text style={styles.body}>{t('culture.connections.quest.deadEnd')}</Text>
                {recovery !== null ? (
                  <Button label={t('culture.connections.quest.goBack', { title: titleOf(state.steps[recovery].node.type, state.steps[recovery].node.id) })} onPress={() => apply(goTo(state, recovery))} testID="quest-recover" />
                ) : (
                  <Button label={t('culture.connections.quest.restartFromStart', { title: titleOf(quest.start.type, quest.start.id) })} onPress={() => apply(startTrail(quest.start))} testID="quest-recover" />
                )}
              </View>
            ) : null}
            {options.next.map((entry) => {
              const title = titleOf(entry.otherType, entry.otherId);
              const source = content.get(entry.connection.source.contentType, entry.connection.source.contentId);
              return (
                <View key={`${entry.connection.id}-${entry.otherId}`} style={styles.option} testID={`quest-option-${entry.otherId}`}>
                  <Text style={styles.meta}>{relation(entry)}</Text>
                  <Text style={styles.bodyBold}>{title}</Text>
                  <Text style={styles.quote}>“{entry.connection.evidence}”</Text>
                  <Text style={styles.meta}>
                    {t('culture.connections.trail.sourced')} · {t('culture.connections.fromArticle', { title: source?.title ?? entry.connection.source.contentId, section: FIELD_LABEL[entry.connection.source.field] ? t(FIELD_LABEL[entry.connection.source.field]) : entry.connection.source.field })}
                  </Text>
                  <View style={styles.row}>
                    <Button label={t('culture.connections.trail.follow', { title })} onPress={() => apply(follow(state, entry, content.exists))} testID={`quest-follow-${entry.otherId}`} />
                    <Button label={t('culture.connections.trail.source')} variant="text" onPress={() => router.push(contentRoute(entry.connection.source.contentType, entry.connection.source.contentId) as never)} testID={`quest-source-${entry.otherId}`} />
                  </View>
                </View>
              );
            })}
            {options.unavailable.map((entry) => (
              <Text key={`missing-${entry.connection.id}`} style={styles.meta} testID={`quest-unavailable-${entry.otherId}`}>
                {t('culture.connections.trail.unavailable', { relation: relation(entry) })}
              </Text>
            ))}
            {hint ? (
              showHint ? (
                <Text style={styles.hint} accessibilityLiveRegion="polite" testID="quest-hint">
                  {t('culture.connections.quest.hintText', { relation: relation(hint), title: titleOf(hint.otherType, hint.otherId) })}
                </Text>
              ) : (
                <Button label={t('culture.connections.quest.hint')} variant="secondary" onPress={() => setShowHint(true)} testID="quest-hint-button" />
              )
            ) : null}
            <View style={styles.row}>
              <Button label={t('culture.connections.quest.restart')} variant="text" onPress={() => apply(startTrail(quest.start))} testID="quest-restart" />
              <Button label={t('culture.connections.quest.otherQuest')} variant="text" onPress={() => setActive(null)} testID="quest-other" />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  section: { ...typography.overline, color: colors.textSecondary },
  heading: { ...textStyles.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyBold: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  bold: { fontWeight: '700' },
  meta: { ...textStyles.small, color: colors.textSecondary },
  quote: { ...textStyles.body, color: colors.textPrimary, fontStyle: 'italic' },
  hint: { ...textStyles.body, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  questCard: { gap: 2, padding: spacing.md, minHeight: 56, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  destination: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.accentTerracotta },
  list: { gap: spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  listRowOn: { borderWidth: 2, borderColor: colors.primary },
  listNumber: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textSecondary, width: 24 },
  hereTag: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  here: { gap: 2, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  option: { gap: 4, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  deadEnd: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.accentTerracotta },
  evidence: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
});
