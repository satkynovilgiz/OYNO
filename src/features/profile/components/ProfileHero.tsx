import { Flame, Pencil, Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, FadeSlideIn, ProgressBar } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import type { ProfileSummary } from '../types';

type ProfileHeroProps = {
  profile: ProfileSummary;
  onPressAvatar?: () => void;
  onPressEdit?: () => void;
};

const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.15, medium: 1.5, compact: 1.65, dense: 1.85 };
const NAME_FONT_SIZE_BY_CARD_SCALE = { large: 28, medium: 24, compact: 21, dense: 19 };

/** OYNO's deep-green SPECIAL surface (spec "Task 12... deep forest green,
 * extremely subtle Kyrgyz ornament, restrained gold details - do NOT
 * cover the entire background in loud patterns") instead of the
 * photographic mountains/yurt/horse background this used to have - one
 * small corner ornament, not a busy scene, so the avatar/name/level/XP
 * stay the clear focal point. */
export function ProfileHero({ profile, onPressAvatar, onPressEdit }: ProfileHeroProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const xpRatio = profile.xpMax > 0 ? profile.xpCurrent / profile.xpMax : 0;

  return (
    <FadeSlideIn style={[styles.card, { aspectRatio: resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE) }, shadows.card]}>
      <View style={styles.ornamentCorner}>
        <OymoOrnament size={22} color="rgba(232,185,61,0.16)" strokeWidth={1.5} />
      </View>

      <View style={styles.content}>
        <AnimatedPressable
          style={styles.avatarWrap}
          onPress={onPressAvatar}
          accessibilityRole="button"
          accessibilityLabel={t('profile.editAvatarLabel')}
        >
          <UserAvatar characterId={profile.characterId} avatarConfig={profile.avatarConfig} size="profile" />
          <View style={styles.cameraBadge}>
            <Wand2 size={14} color={colors.textPrimary} strokeWidth={2.25} />
          </View>
        </AnimatedPressable>

        <View style={styles.textBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { fontSize: resolveByCardScale(config.cardScale, NAME_FONT_SIZE_BY_CARD_SCALE) }]}>
              {profile.name}
            </Text>
            <AnimatedPressable onPress={onPressEdit} accessibilityRole="button" accessibilityLabel={t('profile.editLabel')}>
              <Pencil size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </AnimatedPressable>
          </View>
          <View style={styles.badgeRow}>
            <Text style={styles.level}>{t('profile.level', { level: profile.level })}</Text>
            {profile.streakDays > 0 ? (
              <View style={styles.streakChip}>
                <Flame size={12} color={colors.accentTerracotta} strokeWidth={2.25} />
                <Text style={styles.streakText}>{t('profile.dailyActivity.streak', { count: profile.streakDays })}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {profile.title}
          </Text>
          <View style={styles.xpBlock}>
            <ProgressBar progress={xpRatio} height={5} trackColor="rgba(255,255,255,0.16)" fillColor={colors.accentGold} />
            <Text style={styles.xpLabel}>{t('profile.xpProgress', { current: profile.xpCurrent, max: profile.xpMax })}</Text>
          </View>
        </View>
      </View>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceFeature,
    justifyContent: 'center',
  },
  ornamentCorner: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  avatarWrap: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceFeature,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.display,
    color: colors.textOnDark,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  level: {
    ...typography.bodyBold,
    color: colors.accentGold,
  },
  // Secondary to name/level/XP (spec "Task 12... Streak/status should be
  // secondary") - a quiet translucent chip, not competing for attention.
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  streakText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  title: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  xpBlock: {
    gap: 2,
    marginTop: spacing.xxs,
  },
  xpLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.6)',
  },
});
