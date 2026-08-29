import { Sparkles, UserRound } from 'lucide-react-native';
import { Image, StyleSheet, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { skinToneHex } from '@/services/avatar/avatarColors';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';
import { colors, radii, shadows } from '@/theme';
import heroBackground from '@assets/img/OYNO_design/profile/hero_background.png';

type AvatarPreviewProps = {
  config: AvatarConfig;
};

const PREVIEW_SIZE = 176;

/**
 * The large live-updating preview (spec section 4). Reuses the existing
 * warm mountains/yurt background art (the same asset ProfileHero already
 * uses) rather than inventing new art for this - a real, finished OYNO
 * background, just not yet a *composited* rendering of the selected
 * parts (see UserAvatar's own doc comment on why: no layered artwork
 * exists yet). The circle in front is the same honest work-in-progress
 * treatment UserAvatar shows elsewhere, just larger.
 */
export function AvatarPreview({ config }: AvatarPreviewProps) {
  return (
    <View style={styles.card}>
      <Image
        source={heroBackground}
        style={[StyleSheet.absoluteFillObject, styles.backgroundImage]}
        resizeMode="cover"
      />
      <View style={styles.scrim} />

      <View style={styles.ornamentTopLeft}>
        <OymoOrnament size={20} color={colors.surface} />
      </View>
      <View style={styles.ornamentTopRight}>
        <OymoOrnament size={20} color={colors.surface} />
      </View>

      <View
        style={[
          styles.avatarCircle,
          { width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: PREVIEW_SIZE / 2 },
          { backgroundColor: skinToneHex(config.skinTone) },
        ]}
      >
        <UserRound size={PREVIEW_SIZE * 0.6} color={colors.surface} strokeWidth={1.5} />
        <View style={styles.sparkleBadge}>
          <Sparkles size={20} color={colors.textOnPrimary} strokeWidth={2.25} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 260,
    borderRadius: radii.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(39,28,18,0.28)',
  },
  ornamentTopLeft: {
    position: 'absolute',
    top: 14,
    left: 14,
    opacity: 0.85,
  },
  ornamentTopRight: {
    position: 'absolute',
    top: 14,
    right: 14,
    opacity: 0.85,
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.raised,
  },
  sparkleBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
