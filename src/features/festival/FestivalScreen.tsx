import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import i18n from 'i18next';
import { Check, ChevronLeft, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { changeLanguageTemporarily, type SupportedLanguage } from '@/i18n';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { activityById, currentSession, estimate, isComplete, keepSession, LENGTHS, needsConfirmToEnd, sessionReducer, setsFor, startSession, summary, type Session, type SessionLength } from './festivalModel';

const LANGUAGES: SupportedLanguage[] = ['kg', 'ru', 'en'];

/**
 * /festival - Festival Mode (festivalModel.ts): a short curated session of
 * existing guest activities for a group. Estimates only; explicit Next /
 * End; the session language is chosen here and the app's own language comes
 * back when the session ends. Nothing is stored or scored.
 */
export function FestivalScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const canOpen = (route: string) => !isOffline || isRouteAvailableOffline(route, queryClient);
  const [session, setSessionState] = useState<Session | null>(() => currentSession());
  const [length, setLength] = useState<SessionLength>(10);
  const [language, setLanguage] = useState<SupportedLanguage>((i18n.language as SupportedLanguage) || 'kg');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ended, setEnded] = useState<string[] | null>(null);
  useEffect(() => setSessionState(currentSession()), []);
  const setSession = (next: Session | null) => {
    keepSession(next);
    setSessionState(next);
  };
  const titleOf = (id: string) => {
    const activity = activityById(id);
    return activity?.titleKey ? t(activity.titleKey) : (activity?.title ?? id);
  };

  const begin = (setId: string) => {
    const set = setsFor(length).find((entry) => entry.id === setId);
    if (!set) return;
    const previous = (i18n.language as SupportedLanguage) || 'kg';
    // Explicit, for this session only (the saved app language is left untouched).
    if (language !== previous) void changeLanguageTemporarily(language);
    setEnded(null);
    setSession(startSession(set, language, previous, canOpen));
  };
  const end = () => {
    if (!session) return;
    const explored = summary(session);
    if (session.language !== session.previousLanguage) void changeLanguageTemporarily(session.previousLanguage);
    setSession(null); // temporary state cleared
    setConfirmEnd(false);
    setEnded(explored);
  };
  const open = (index: number) => {
    if (!session) return;
    const item = session.items[index];
    const activity = item ? activityById(item.id) : null;
    if (!activity || !item.available) return;
    setSession(sessionReducer(session, { type: 'open', index }));
    router.push(activity.route as never);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('festival.title')}
      </Text>
    </View>
  );

  let body: React.ReactNode;
  if (ended) {
    body = (
      <View style={styles.stack} testID="festival-summary">
        <Text style={styles.heading} accessibilityRole="header">
          {t('festival.summaryTitle')}
        </Text>
        {ended.length === 0 ? <Text style={styles.body}>{t('festival.summaryNone')}</Text> : null}
        {ended.map((id) => (
          <View key={id} style={styles.row}>
            <Check size={16} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.body, styles.flex]}>{titleOf(id)}</Text>
          </View>
        ))}
        <Text style={styles.meta}>{t('festival.summaryNote')}</Text>
        <Button label={t('festival.another')} onPress={() => setEnded(null)} testID="festival-another" />
      </View>
    );
  } else if (!session) {
    body = (
      <View style={styles.stack} testID="festival-setup">
        <Text style={styles.body}>{t('festival.intro')}</Text>
        <Text style={styles.note}>{t('festival.noAccount')}</Text>
        <Text style={styles.section}>{t('festival.lengthTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('festival.lengthTitle')}>
          {LENGTHS.map((option) => (
            <AnimatedPressable key={option} style={[styles.chip, length === option && styles.chipOn]} onPress={() => setLength(option)} accessibilityRole="radio" accessibilityState={{ checked: length === option }} aria-checked={length === option} testID={`festival-length-${option}`}>
              <Text style={[styles.chipText, length === option && styles.chipTextOn]}>{t('festival.minutes', { count: option })}</Text>
            </AnimatedPressable>
          ))}
        </View>
        <Text style={styles.meta}>{t('festival.estimateNote')}</Text>
        <Text style={styles.section}>{t('festival.languageTitle')}</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('festival.languageTitle')}>
          {LANGUAGES.map((option) => (
            <AnimatedPressable key={option} style={[styles.chip, language === option && styles.chipOn]} onPress={() => setLanguage(option)} accessibilityRole="radio" accessibilityState={{ checked: language === option }} aria-checked={language === option} testID={`festival-language-${option}`}>
              <Text style={[styles.chipText, language === option && styles.chipTextOn]}>{t(`festival.languages.${option}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
        <Text style={styles.meta}>{t('festival.languageNote')}</Text>
        <Text style={styles.section}>{t('festival.setsTitle')}</Text>
        {setsFor(length).map((set) => (
          <View key={set.id} style={styles.card} testID={`festival-set-${set.id}`}>
            <Text style={styles.cardTitle}>{t(`festival.sets.${set.id}`)}</Text>
            <Text style={styles.meta}>{set.activityIds.map(titleOf).join(' · ')}</Text>
            <Text style={styles.meta}>{t('festival.about', { count: estimate(set) })}</Text>
            <Button label={t('festival.start')} onPress={() => begin(set.id)} testID={`festival-start-${set.id}`} />
          </View>
        ))}
      </View>
    );
  } else {
    const done = isComplete(session);
    body = (
      <View style={styles.stack} testID="festival-session">
        <Text style={styles.meta}>{t('festival.sessionMeta', { count: session.length, minutes: session.length })}</Text>
        {session.items.map((item, index) => {
          const activity = activityById(item.id);
          const isCurrent = index === session.current;
          return (
            <View key={`${item.id}-${index}`} style={[styles.card, isCurrent && styles.current]} testID={`festival-item-${index}`}>
              <View style={styles.row}>
                {activity?.together ? <Users size={16} color={colors.textSecondary} strokeWidth={2} /> : null}
                <Text style={[styles.cardTitle, styles.flex]}>
                  {index + 1}. {titleOf(item.id)}
                </Text>
                <Text style={styles.meta}>{t(`festival.status.${item.status}`)}</Text>
              </View>
              {item.replaces ? <Text style={styles.meta}>{t('festival.replaced', { name: titleOf(item.replaces) })}</Text> : null}
              {!item.available ? <Text style={styles.warn}>{t('festival.unavailable')}</Text> : null}
              {activity ? <Text style={styles.meta}>{t('festival.about', { count: activity.minutes })}</Text> : null}
              {isCurrent && item.available ? <Button label={item.status === 'waiting' ? t('festival.open') : t('festival.openAgain')} onPress={() => open(index)} testID={`festival-open-${index}`} /> : null}
            </View>
          );
        })}
        {!done ? (
          <View style={styles.wrap}>
            <Button label={t('festival.next')} disabled={session.items[session.current]?.status === 'waiting'} onPress={() => setSession(sessionReducer(session, { type: 'next' }))} testID="festival-next" />
            <Button label={t('festival.skip')} variant="text" onPress={() => setSession(sessionReducer(session, { type: 'skip' }))} testID="festival-skip" />
          </View>
        ) : (
          <Text style={styles.body} testID="festival-all-done">
            {t('festival.allDone')}
          </Text>
        )}
        {confirmEnd ? (
          <View style={styles.card} testID="festival-end-confirm">
            <Text style={styles.body}>{t('festival.endConfirm')}</Text>
            <View style={styles.wrap}>
              <Button label={t('festival.endYes')} onPress={end} testID="festival-end-yes" />
              <Button label={t('festival.endNo')} variant="text" onPress={() => setConfirmEnd(false)} />
            </View>
          </View>
        ) : (
          <Button label={t('festival.end')} variant="secondary" onPress={() => (needsConfirmToEnd(session) ? setConfirmEnd(true) : end())} testID="festival-end" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>{body}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  current: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
});
