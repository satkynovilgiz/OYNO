import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Pencil, Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { AnimatedPressable, FadeSlideIn, ProgressBar } from '@/components/ui';
import { resolveByCardScale } from '@/services/ageExperience/scale';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import heroBackground from '@assets/img/OYNO_design/profile/hero_background.png';

import type { ProfileSummary } from '../types';

type ProfileHeroProps = {
  profile: ProfileSummary;
  onPressAvatar?: () => void;
  onPressEdit?: () => void;
};

const ASPECT_RATIO_BY_CARD_SCALE = { large: 1.35, medium: 1.75, compact: 1.9, dense: 2.1 };
const NAME_FONT_SIZE_BY_CARD_SCALE = { large: 28, medium: 24, compact: 21, dense: 19 };

/** Background art (mountains, yurt, horse) sliced from the design
 * reference, right-aligned; a cream fade over the left keeps the avatar
 * and text on a clean, legible surface regardless of what's behind them. */
export function ProfileHero({ profile, onPressAvatar, onPressEdit }: ProfileHeroProps) {
  const { t } = useTranslation();
  const { config } = useAgeExperience();
  const xpRatio = profile.xpMax > 0 ? profile.xpCurrent / profile.xpMax : 0;

  return (
    <FadeSlideIn style={[styles.card, { aspectRatio: resolveByCardScale(config.cardScale, ASPECT_RATIO_BY_CARD_SCALE) }, shadows.card]}>
      <Image source={heroBackground} style={[StyleSheet.absoluteFill, styles.image]} resizeMode="cover" />
      <LinearGradient
        colors={[colors.surface, colors.surface, 'rgba(251,243,227,0)']}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <AnimatedPressable
          style={styles.avatarWrap}
          onPress={onPressAvatar}
          accessibilityRole="button"
          accessibilityLabel={t('profile.editAvatarLabel')}
        >
          <UserAvatar characterId={profile.characterId} avatarConfig={profile.avatarConfig} size="profile" />
          <View style={styles.cameraBadge}>
            <Wand2 size={14} color={colors.textOnPrimary} strokeWidth={2.25} />
          </View>
        </AnimatedPressable>

        <View style={styles.textBlock}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { fontSize: resolveByCardScale(config.cardScale, NAME_FONT_SIZE_BY_CARD_SCALE) }]}>
              {profile.name}
            </Text>
            <AnimatedPressable onPress={onPressEdit} accessibilityRole="button" accessibilityLabel={t('profile.editLabel')}>
              <Pencil size={16} color={colors.textSecondary} strokeWidth={2} />
            </AnimatedPressable>
          </View>
          <View style={styles.badgeRow}>
            <Text style={styles.level}>{t('profile.level', { level: profile.level })}</Text>
            {profile.streakDays > 0 ? (
              <View style={styles.streakChip}>
                <Flame size={12} color={colors.accentGold} strokeWidth={2.25} />
                <Text style={styles.streakText}>{t('profile.dailyActivity.streak', { count: profile.streakDays })}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {profile.title}
          </Text>
          <View style={styles.xpBlock}>
            <ProgressBar progress={xpRatio} height={5} />
            <Text style={styles.xpLabel}>{profile.xpCurrent} / {profile.xpMax} XP</Text>
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
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
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
    color: colors.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  level: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  streakText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  title: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  xpBlock: {
    gap: 2,
    marginTop: spacing.xxs,
  },
  xpLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
});
