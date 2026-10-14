import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Skeleton } from '@/components/ui';
import { cardRadii, cards, colors, headings, layout, spacing, text } from '@/theme';

import { SLOW_AFTER_MS, type ScreenState } from './stateRules';

type Action = { label: string; onPress: () => void; testID?: string };

/**
 * Loading. With a `skeleton` (only when it really is the shape of what
 * comes next) or a labelled indicator. After SLOW_AFTER_MS it explains and
 * - when `onRetry` is given - offers Try again, so it can't spin forever
 * without a word.
 */
export function LoadingState({ label, skeleton, onRetry, testID = 'state-loading' }: { label: string; skeleton?: ReactNode; onRetry?: () => void; testID?: string }) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={styles.block} testID={testID} accessibilityLiveRegion="polite">
      {skeleton ?? <ActivityIndicator color={colors.primary} />}
      <Text style={styles.meta} accessibilityRole="text">
        {label}
      </Text>
      {slow ? (
        <View style={styles.slow} testID={`${testID}-slow`}>
          <Text style={styles.body}>{t('states.slow')}</Text>
          {onRetry ? <Button label={t('common.retry')} variant="secondary" size="sm" onPress={onRetry} testID={`${testID}-retry`} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Empty / not found / unavailable / error: a plain title, what it means, and the ONE relevant action. */
export function StateMessage({ kind, title, body, action, secondary, testID }: { kind: Exclude<ScreenState, 'ready' | 'loading'>; title: string; body?: string; action?: Action; secondary?: Action; testID?: string }) {
  return (
    <View style={[styles.block, kind === 'error' && styles.errorBlock]} testID={testID ?? `state-${kind}`} accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action || secondary ? (
        <View style={styles.actions}>
          {action ? <Button label={action.label} onPress={action.onPress} variant={kind === 'empty' ? 'secondary' : 'primary'} testID={action.testID} /> : null}
          {secondary ? <Button label={secondary.label} onPress={secondary.onPress} variant="text" testID={secondary.testID} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** One part failed while the rest of the screen loaded: said in place, with its own retry. */
export function SectionError({ message, onRetry, testID }: { message: string; onRetry?: () => void; testID?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.inline} testID={testID} accessibilityLiveRegion="polite">
      <Text style={[styles.body, styles.flex]}>{message}</Text>
      {onRetry ? <Button label={t('common.retry')} variant="secondary" size="sm" onPress={onRetry} testID={testID ? `${testID}-retry` : undefined} /> : null}
    </View>
  );
}

/** A full screen for a state (header with Back, then the state) - for routes that have nothing else to show. */
export function StateScreen({ onPressBack, children, testID, align = 'center' }: { onPressBack: () => void; children: ReactNode; testID?: string; align?: 'center' | 'top' }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen} testID={testID}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} testID="state-back" />
      </View>
      <View style={[styles.screenBody, align === 'top' && styles.screenTop]}>{children}</View>
    </View>
  );
}

/** The article layout while it loads: hero block, title line, section label, paragraph lines. */
export function ArticleSkeleton() {
  return (
    <View style={styles.skeleton}>
      <Skeleton height={220} borderRadius={cardRadii.hero} />
      <View style={styles.skeletonText}>
        <Skeleton height={28} width="70%" />
        <Skeleton height={12} width="30%" />
        <Skeleton height={14} />
        <Skeleton height={14} />
        <Skeleton height={14} width="85%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: layout.gutter },
  screenBody: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.gutter, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  // A skeleton sits where the content will appear.
  screenTop: { justifyContent: 'flex-start' },
  block: { gap: spacing.sm, paddingVertical: spacing.lg, alignItems: 'stretch' },
  errorBlock: { ...cards.standard, borderColor: colors.dangerText, paddingVertical: spacing.md },
  title: { ...headings.section, color: colors.textPrimary },
  body: { ...text.body, color: colors.textPrimary },
  meta: { ...text.meta, color: colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  slow: { gap: spacing.xs, alignItems: 'flex-start' },
  inline: { ...cards.compact, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, borderColor: colors.dangerText },
  flex: { flex: 1, minWidth: 180 },
  skeleton: { gap: spacing.md, alignSelf: 'stretch' },
  skeletonText: { gap: spacing.sm, paddingHorizontal: spacing.xs },
});
