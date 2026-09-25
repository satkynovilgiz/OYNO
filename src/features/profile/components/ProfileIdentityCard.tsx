import { Pencil, Wand2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/avatar';
import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, LevelBadge, ProgressBar } from '@/components/ui';
import type { AgeExperience } from '@/services/ageExperience/types';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import type { ProfileSummary } from '../types';

/**
 * Who am I in OYNO - a medium, compact identity card: avatar (one fine gold
 * ring + a small edit mark), name (+ edit), Level + rank, and the real XP
 * bar. Stats are a quieter row passed in as `stats`. No giant dark box, no
 * glowing level card.
 */
export function ProfileIdentityCard({
  profile,
  experience,
  stats,
  onPressAvatar,
  onPressEditName,
}: {
  profile: ProfileSummary;
  experience: AgeExperience;
  stats: ReactNode;
  onPressAvatar: () => void;
  onPressEditName: () => void;
}) {
  const { t } = useTranslation();
  const big = experience === 'child';
  const rewarding = experience === 'child' || experience === 'preteen';
  const ratio = profile.xpMax > 0 ? profile.xpCurrent / profile.xpMax : 0;

  return (
    <View style={styles.card}>
      <View style={styles.corner} pointerEvents="none">
        <OymoOrnament size={16} color="rgba(199,154,46,0.35)" strokeWidth={1.5} />
      </View>
      <View style={styles.top}>
        <AnimatedPressable style={[styles.avatar, big && styles.avatarBig]} onPress={onPressAvatar} press="soft" haptic="light" accessibilityRole="button" accessibilityLabel={t('profile.editAvatarLabel')}>
          <View style={[styles.avatarClip, big && styles.avatarClipBig]}>
            <UserAvatar characterId={profile.characterId} avatarConfig={profile.avatarConfig} size={big ? 'large' : 'medium'} />
          </View>
          <View style={styles.editMark}>
            <Wand2 size={11} color={colors.textPrimary} strokeWidth={2.5} />
          </View>
        </AnimatedPressable>

        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, experience === 'adult' ? editorial(textStyles.h2) : textStyles.h2]} numberOfLines={1} accessibilityRole="header">
              {profile.name}
            </Text>
            <AnimatedPressable onPress={onPressEditName} hitSlop={10} press="strong" accessibilityRole="button" accessibilityLabel={t('profile.v2.editName')}>
              <Pencil size={15} color={colors.textMuted} strokeWidth={2} />
            </AnimatedPressable>
          </View>
          <View style={styles.levelRow}>
            <LevelBadge label={t('profile.level', { level: profile.level })} tone={rewarding ? 'gold' : 'forest'} />
            <Text style={styles.rank} numberOfLines={2}>
              {profile.title}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.xp}>
        <ProgressBar progress={ratio} height={6} fillColor={rewarding ? colors.accentGold : colors.primary} trackColor={colors.surfaceMuted} />
        <Text style={styles.xpText}>{t('profile.xpProgress', { current: profile.xpCurrent, max: profile.xpMax })}</Text>
      </View>

      {stats}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  corner: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 68, height: 68 },
  avatarBig: { width: 96, height: 96 },
  avatarClip: { width: 68, height: 68, borderRadius: 34, overflow: 'hidden', borderWidth: 2, borderColor: colors.accentGold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  avatarClipBig: { width: 96, height: 96, borderRadius: 48 },
  editMark: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentGold, borderWidth: 2, borderColor: colors.surfaceElevated },
  identity: { flex: 1, gap: 6, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.lg },
  name: { color: colors.textPrimary, flexShrink: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  rank: { ...textStyles.caption, color: colors.textSecondary, flexShrink: 1 },
  xp: { gap: 4 },
  xpText: { ...textStyles.small, color: colors.textSecondary },
});
