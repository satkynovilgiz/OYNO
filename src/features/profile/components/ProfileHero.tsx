import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character';
import { AnimatedPressable } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import heroBackground from '@assets/img/OYNO_design/profile/hero_background.png';

import type { ProfileSummary } from '../types';

type ProfileHeroProps = {
  profile: ProfileSummary;
  onPressAvatar?: () => void;
  onPressEdit?: () => void;
};

/** Background art (mountains, yurt, horse) sliced from the design
 * reference, right-aligned; a cream fade over the left keeps the avatar
 * and text on a clean, legible surface regardless of what's behind them. */
export function ProfileHero({ profile, onPressAvatar, onPressEdit }: ProfileHeroProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, shadows.card]}>
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
          accessibilityLabel={t('profile.changePhotoLabel')}
        >
          <CharacterAvatar characterId={profile.characterId} emotion="happy" size={92} />
          <View style={styles.cameraBadge}>
            <Camera size={14} color={colors.textOnPrimary} strokeWidth={2.25} />
          </View>
        </AnimatedPressable>

        <View style={styles.textBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            <AnimatedPressable onPress={onPressEdit} accessibilityRole="button" accessibilityLabel={t('profile.editLabel')}>
              <Pencil size={16} color={colors.textSecondary} strokeWidth={2} />
            </AnimatedPressable>
          </View>
          <Text style={styles.level}>{t('profile.level', { level: profile.level })}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {profile.title}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2.1,
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
  level: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  title: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
