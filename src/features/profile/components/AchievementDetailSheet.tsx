import { router } from 'expo-router';
import { CircleCheck, Lock, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Button } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { formatLongDate } from '@/services/i18n/formatDate';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { cardRadii, colors, editorial, elevation, radii, spacing, textStyles } from '@/theme';

import type { AchievementCard } from '../achievementsModel';

const GO_KEY: Record<string, string> = { '/games': 'games', '/explore': 'explore', '/daily': 'daily' };

/**
 * Compact bottom sheet for one achievement: the medal, title, clear state
 * (earned with its real date if recorded / locked with the real
 * requirement), and ONE action - where to earn it, or Share once earned
 * (through the normal share preview). No trophy fanfare.
 */
export function AchievementDetailSheet({ card, onClose, onShare }: { card: AchievementCard | null; onClose: () => void; onShare: (card: AchievementCard) => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  if (!card) return null;
  const requirement = t(card.requirementKey);
  const goLabel = t(`profile.achievements.v2.go.${GO_KEY[card.route] ?? 'culture'}`);

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.cancel')} />
      <View style={[styles.sheet, elevation.floating, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={[styles.badgeStage, card.earned && styles.badgeStageEarned]}>
          <Image source={card.iconSource} style={[styles.badge, !card.earned && styles.badgeLocked]} resizeMode="contain" accessibilityIgnoresInvertColors />
          {!card.earned ? (
            <View style={styles.lock}>
              <Lock size={14} color={colors.textOnDark} strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
        <Text style={styles.category}>{t(`profile.achievements.v2.categories.${card.category}`)}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t(card.titleKey)}
        </Text>
        <View style={[styles.status, card.earned ? styles.statusEarned : styles.statusLocked]}>
          {card.earned ? <CircleCheck size={14} color={colors.textPrimary} strokeWidth={2.5} /> : <Lock size={13} color={colors.textSecondary} strokeWidth={2.5} />}
          <Text style={[styles.statusText, card.earned && styles.statusTextEarned]}>
            {card.earned && card.earnedAt
              ? t('profile.achievements.v2.earnedOn', { date: formatLongDate(localDateKey(new Date(card.earnedAt)), i18n.language as SupportedLanguage) })
              : t(card.earned ? 'profile.achievements.unlockedBadge' : 'profile.achievements.lockedBadge')}
          </Text>
        </View>
        <View style={styles.requirement}>
          <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
          <Text style={styles.requirementText}>
            {card.earned ? t('profile.achievements.v2.earnedBy', { requirement }) : `${t('profile.achievements.requirementLabel')}: ${requirement}`}
          </Text>
        </View>
        <View style={styles.actions}>
          {card.earned ? (
            <Button label={t('profile.achievements.v2.share')} icon={<Share2 size={16} color={colors.textPrimary} strokeWidth={2.25} />} variant="accent" block onPress={() => onShare(card)} />
          ) : (
            <Button
              label={goLabel}
              variant="primary"
              block
              onPress={() => {
                onClose();
                router.push(card.route as never);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(19,32,24,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs, paddingHorizontal: spacing.lg, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, marginBottom: spacing.sm },
  badgeStage: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  badgeStageEarned: { backgroundColor: 'rgba(232,185,61,0.18)' },
  badge: { width: 132, height: 132 },
  badgeLocked: { opacity: 0.6 },
  lock: { position: 'absolute', right: 10, bottom: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19,32,24,0.8)' },
  category: { ...textStyles.overline, color: colors.accentTerracotta, marginTop: spacing.xs },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.pill },
  statusEarned: { backgroundColor: colors.accentGold },
  statusLocked: { backgroundColor: colors.surfaceMuted },
  statusText: { ...textStyles.small, color: colors.textSecondary },
  statusTextEarned: { color: colors.textPrimary },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs, paddingHorizontal: spacing.md },
  requirementText: { ...textStyles.body, color: colors.textSecondary, textAlign: 'center', flexShrink: 1 },
  actions: { alignSelf: 'stretch', marginTop: spacing.md },
});
