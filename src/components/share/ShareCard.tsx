import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, fontFamily, spacing, typography } from '@/theme';

/** Logical size of the card - captured at 1080×1350 physical (4:5 post). */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;

export type ShareCardContent = {
  title: string;
  /** Small category label, e.g. "Табигый жер" / "Маданият". */
  label: string;
  imageSource: ImageSourcePropType | null;
  /** Flat tone used when there's no photo (same tone the source screen
   * uses for that content). */
  fallbackTone?: string;
  /** Shown only for genuinely completed content (Daily, Collection). */
  completedLabel?: string | null;
};

type ShareCardProps = ShareCardContent & {
  onImageReady?: () => void;
};

/**
 * The one OYNO share image: full-bleed artwork, a controlled bottom
 * gradient, a small category label, the title, an optional completion
 * seal, and a quiet OYNO wordmark with an oymo mark. Deliberately carries
 * no user data - no name, avatar, email, id or location - only the
 * content being shared.
 */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { title, label, imageSource, fallbackTone = colors.surfaceFeature, completedLabel, onImageReady },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: fallbackTone }]}>
      {imageSource ? (
        <Image source={imageSource} style={styles.fill} resizeMode="cover" onLoad={onImageReady} onError={onImageReady} />
      ) : (
        <View style={styles.fallbackMark}>
          <OymoOrnament size={120} color="rgba(255,255,255,0.14)" strokeWidth={1} />
        </View>
      )}
      <LinearGradient
        colors={['rgba(19,32,24,0.35)', 'rgba(19,32,24,0)', 'rgba(19,32,24,0.2)', 'rgba(19,32,24,0.92)']}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.brandRow}>
        <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={styles.wordmark}>OYNO</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.title} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Text>
        {completedLabel ? (
          <View style={styles.completed}>
            <OymoOrnament size={10} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.completedText}>{completedLabel}</Text>
          </View>
        ) : null}
        <View style={styles.footerRule}>
          <View style={styles.ruleLine} />
          <OymoOrnament size={8} color="rgba(232,185,61,0.8)" strokeWidth={1.5} />
          <View style={styles.ruleLine} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fallbackMark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  wordmark: {
    fontFamily: fontFamily.wordmark,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.textOnDark,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    ...typography.overline,
    color: colors.accentGold,
  },
  title: {
    fontFamily: fontFamily.wordmark,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colors.textOnDark,
  },
  completed: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accentGold,
    marginTop: spacing.xxs,
  },
  completedText: {
    ...typography.small,
    color: colors.textPrimary,
  },
  footerRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ruleLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(232,185,61,0.5)',
  },
});
