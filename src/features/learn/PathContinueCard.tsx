import { useQueryClient } from '@tanstack/react-query';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button } from '@/components/ui';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { useLearningPathStore } from '@/store/useLearningPathStore';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { learnRoute, pathContextFor, pathContextValid, pathContinuation, type LearningPath } from './learningPaths';
import { usePathSignals } from './usePathSignals';
import { gameRouteFor, useStepDisplay } from './useStepDisplay';

export const PORTFOLIO_ROUTE = '/profile/portfolio';

/** The path context of the current screen: only when it was opened FROM a
 * path (`?fromPath=`) AND is one of that path's steps, for the account that
 * opened it. Anything else - a direct link, an unrelated screen, another
 * account after a switch - has no path context. */
export function usePathContext(owner: string): { path: LearningPath; stepIndex: number } | null {
  const pathname = usePathname();
  const { fromPath } = useGlobalSearchParams<{ fromPath?: string }>();
  const context = pathContextFor(typeof fromPath === 'string' ? fromPath : undefined, pathname, gameRouteFor);
  // The account the journey started with (per screen visit).
  const startedOwner = useRef<{ key: string; owner: string } | null>(null);
  const key = context ? `${context.path.id}|${pathname}` : null;
  if (key && startedOwner.current?.key !== key) startedOwner.current = { key, owner };
  if (!context || !pathContextValid(startedOwner.current?.owner ?? null, owner)) return null;
  return context;
}

/** Opens a step with `fromPath` so the app keeps offering the journey. */
export function stepHref(route: string, pathId: string): string {
  return `${route}${route.includes('?') ? '&' : '?'}fromPath=${pathId}`;
}

/**
 * "Continue learning" after a GENUINELY completed step (existing signals -
 * opening a screen never completes it). Steps without reliable evidence ask
 * for the manual confirmation first. Shows the next activity's type and
 * title before navigating, says honestly when it cannot open offline, and
 * ends with a short completion state (Portfolio + another path).
 *
 * `inline`: inside the game result sheet (navigation REPLACES the game
 * screen so the sheet never stays above the next activity).
 */
export function PathContinueCard({ inline = false, onDismiss }: { inline?: boolean; onDismiss?: () => void }) {
  const { t } = useTranslation();
  const { signals, owner, ready } = usePathSignals();
  const context = usePathContext(owner);
  const display = useStepDisplay();
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  if (!context || !ready) return null;
  const { path, stepIndex } = context;
  const continuation = pathContinuation(path, stepIndex, signals);
  const go = (href: string) => (inline ? router.replace(href as never) : router.push(href as never));
  // To the path itself (pops chained steps; replaces when the path is not in the stack).
  const backToPath = () => router.dismissTo(learnRoute(path.id) as never);

  const dismiss = onDismiss ? (
    <AnimatedPressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.close} testID="path-continue-dismiss">
      <X size={16} color={colors.textSecondary} strokeWidth={2} />
    </AnimatedPressable>
  ) : null;

  if (continuation.kind === 'pending') {
    // Games: say what counts (practice rounds never complete a path step).
    if (!inline || path.steps[stepIndex].type !== 'game') return null;
    return (
      <View style={[styles.card, styles.cardInline]} testID="path-continue">
        <Text style={styles.kicker}>{t(path.titleKey)}</Text>
        <Text style={styles.body} testID="path-continue-pending">
          {t('pathJourney.officialRoundNeeded')}
        </Text>
      </View>
    );
  }

  if (continuation.kind === 'confirm') {
    return (
      <View style={[styles.card, inline && styles.cardInline]} testID="path-continue" accessibilityLiveRegion="polite">
        {dismiss}
        <Text style={styles.kicker}>{t(path.titleKey)}</Text>
        <Text style={styles.body}>{t('pathJourney.confirmPrompt')}</Text>
        <Button label={t('learningPaths.markComplete')} size="sm" variant="secondary" onPress={() => useLearningPathStore.getState().setManual(owner, path.id, continuation.step.id, true)} testID="path-continue-confirm" />
      </View>
    );
  }

  if (continuation.kind === 'done') {
    const other = continuation.otherPath;
    return (
      <View style={[styles.card, inline && styles.cardInline]} testID="path-continue" accessibilityLiveRegion="polite">
        {dismiss}
        <View style={styles.row}>
          <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
          <Text style={styles.title} accessibilityRole="header" testID="path-continue-done">
            {t('learningPaths.completed')}: {t(path.titleKey)}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button label={t('pathJourney.viewPortfolio')} size="sm" onPress={() => go(PORTFOLIO_ROUTE)} testID="path-continue-portfolio" />
          {other ? <Button label={`${t('pathJourney.anotherPath')}: ${t(other.titleKey)}`} size="sm" variant="secondary" onPress={() => go(learnRoute(other.id))} testID="path-continue-other" /> : null}
        </View>
      </View>
    );
  }

  const next = display(continuation.step);
  const nextLabel = `${next.verb}: ${next.title}`;
  const unavailableOffline = !!next.route && isOffline && !isRouteAvailableOffline(next.route, queryClient);
  return (
    <View style={[styles.card, inline && styles.cardInline]} testID="path-continue" accessibilityLiveRegion="polite">
      {dismiss}
      <Text style={styles.kicker}>
        {t('pathJourney.stepDone')} · {t('learningPaths.step', { index: continuation.index + 1 })}/{path.steps.length}
      </Text>
      <Text style={styles.typeLabel}>{next.verb}</Text>
      <Text style={styles.title} numberOfLines={2} testID="path-continue-next">
        {next.title}
      </Text>
      {!next.route ? (
        <>
          <Text style={styles.body}>{t('pathJourney.nextMissing')}</Text>
          <Button label={t('learningPaths.backToPath')} size="sm" variant="secondary" onPress={backToPath} testID="path-continue-back" />
        </>
      ) : unavailableOffline ? (
        <>
          <Text style={styles.body} testID="path-continue-offline">
            {t('pathJourney.nextOffline')}
          </Text>
          <Button label={t('learningPaths.backToPath')} size="sm" variant="secondary" onPress={backToPath} testID="path-continue-back" />
        </>
      ) : (
        <Button label={t('pathJourney.continueLearning')} size="sm" accessibilityHint={nextLabel} onPress={() => go(stepHref(next.route!, path.id))} testID="path-continue-go" />
      )}
    </View>
  );
}

/** Overlay variant for step screens: collapsible so it never blocks reading. */
export function PathContinueOverlay() {
  const pathname = usePathname();
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);
  if (dismissedOn === pathname) return null;
  return <PathContinueCard onDismiss={() => setDismissedOn(pathname)} />;
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentGold },
  cardInline: { marginTop: spacing.sm },
  close: { position: 'absolute', top: spacing.xs, right: spacing.xs, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  kicker: { ...typography.overline, color: colors.accentTerracottaText, paddingRight: spacing.lg },
  typeLabel: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  body: { ...textStyles.small, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
