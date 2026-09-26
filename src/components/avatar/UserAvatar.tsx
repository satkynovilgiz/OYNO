import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import type { CharacterId } from '@/components/character';
import { AVATAR_BUST_ART } from '@/services/avatar/avatarArt';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';
import { createDefaultAvatarConfig } from '@/services/avatar/defaultAvatar';
import { colors } from '@/theme';

export type UserAvatarSize = 'tiny' | 'small' | 'medium' | 'large' | 'profile';

const SIZE_PX: Record<UserAvatarSize, number> = {
  tiny: 28,
  small: 40,
  medium: 56,
  large: 88,
  profile: 108,
};

type UserAvatarProps = {
  /** Kept for call-site compatibility; NOT rendered. The Story Companion
   * is the OYNO guide, never the user's picture. */
  characterId?: CharacterId;
  /** null = the user has never saved a customized avatar - renders the
   * real default avatar (the same one "Skip" in setup saves), not the
   * companion's portrait. See useAvatarStore's `hasEverSaved` flag. */
  avatarConfig: AvatarConfig | null;
  size?: UserAvatarSize;
};

/**
 * The single reusable "this is the player" avatar, used everywhere the
 * app shows the signed-in user (Profile, Home, Explore, Culture headers).
 * Once a user *has* customized, this renders AVATAR_BUST_ART[base] - one
 * static illustrated portrait per base (see avatarArt.ts's provenance
 * note). IMPORTANT: that portrait bakes in its own fixed hairstyle/
 * headwear/clothing, so it does NOT yet reflect the user's actual
 * hair/headwear/clothing/accessory selections - only `base` changes what
 * renders here. A true per-part composite needs layered art that doesn't
 * exist yet (see the Avatar Creator implementation plan's art-
 * requirements appendix); this is an honest one-portrait-per-base
 * placeholder, not a finished composited illustration.
 */
const DEFAULT_AVATAR = createDefaultAvatarConfig();

export function UserAvatar({ avatarConfig, size = 'medium' }: UserAvatarProps) {
  const { t } = useTranslation();
  const px = SIZE_PX[size];
  // Only the large Profile-header instance gets the gold "this is the
  // centerpiece" ring - every smaller instance (Home/Explore/Culture
  // headers) keeps the neutral border so gold stays a special-state
  // accent instead of being sprinkled on every avatar in the app.
  const isHero = size === 'profile';

  // Identity is always the user's avatar - the default one until they
  // customize (it used to fall back to the Story Companion's portrait).
  const config = avatarConfig ?? DEFAULT_AVATAR;

  const dimensionStyle = { width: px, height: px, borderRadius: px / 2 };
  const badgeSize = Math.max(16, Math.round(px * 0.3));

  return (
    <View style={isHero ? [styles.heroRing, { borderRadius: (px + 6) / 2 }] : undefined}>
      <View style={[styles.wrap, dimensionStyle, isHero && styles.wrapHero]} accessibilityLabel={avatarConfig ? t('avatar.wipAvatarLabel') : t('avatar.yourAvatar')}>
        <Image source={AVATAR_BUST_ART[config.base]} style={dimensionStyle} resizeMode="cover" />
        {avatarConfig ? (
          <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
            <Sparkles size={badgeSize * 0.6} color={colors.textOnPrimary} strokeWidth={2.25} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRing: {
    padding: 3,
    borderWidth: 2,
    borderColor: colors.accentGold,
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
  },
  wrapHero: {
    borderColor: colors.surface,
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
