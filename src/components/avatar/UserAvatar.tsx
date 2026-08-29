import { Sparkles, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CharacterAvatar, type CharacterId } from '@/components/character';
import { skinToneHex } from '@/services/avatar/avatarColors';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';
import { colors } from '@/theme';

export type UserAvatarSize = 'tiny' | 'small' | 'medium' | 'large' | 'profile';

const SIZE_PX: Record<UserAvatarSize, number> = {
  tiny: 28,
  small: 40,
  medium: 56,
  large: 88,
  profile: 92,
};

type UserAvatarProps = {
  characterId: CharacterId;
  /** null = the user has never explicitly saved a customized avatar -
   * renders exactly what this app already shows today (the story
   * character's portrait), so every existing account looks unchanged
   * until they opt in. See useAvatarStore's `hasEverSaved` flag. */
  avatarConfig: AvatarConfig | null;
  size?: UserAvatarSize;
};

/**
 * The single reusable "this is the player" avatar, used everywhere the
 * app shows the signed-in user (Profile, Home, Explore, Culture headers).
 * No layered/illustrated avatar rendering exists yet (see the Avatar
 * Creator implementation plan's art-requirements appendix) - once a user
 * *has* customized, this renders an honestly-labeled work-in-progress
 * placeholder (their chosen skin tone + a generic person icon + a small
 * "customized" badge), never a fake illustration pretending to be
 * finished art.
 */
export function UserAvatar({ characterId, avatarConfig, size = 'medium' }: UserAvatarProps) {
  const { t } = useTranslation();
  const px = SIZE_PX[size];

  if (!avatarConfig) {
    return <CharacterAvatar characterId={characterId} emotion="happy" size={px} />;
  }

  const dimensionStyle = { width: px, height: px, borderRadius: px / 2 };
  const badgeSize = Math.max(16, Math.round(px * 0.3));

  return (
    <View
      style={[styles.wrap, dimensionStyle, { backgroundColor: skinToneHex(avatarConfig.skinTone) }]}
      accessibilityLabel={t('avatar.wipAvatarLabel')}
    >
      <UserRound size={px * 0.6} color={colors.surface} strokeWidth={1.75} />
      <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
        <Sparkles size={badgeSize * 0.6} color={colors.textOnPrimary} strokeWidth={2.25} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
