import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, editorial, spacing, textStyles } from '@/theme';

/** Logical size of the card - captured at 1080×1350 physical (4:5 post). */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;

/**
 * One OYNO share family, three layouts:
 *   story    content card (place, culture item, collection, trail, Daily)
 *   score    a real number is the hero (challenge result, Passport count,
 *            trail stops) - never a rank or an intelligence label
 *   journal  scrapbook memory: framed picture on cream paper, title, the
 *            one line the user typed for the card, linked content
 *   badge    an earned achievement: the medal art whole (never cropped) on
 *            forest green, its title - no rank, no rarity, no user data
 *   creation a design the user made in a Culture Lab (oymo, shyrdak):
 *            the live artwork, the lab it came from - nothing else
 * All share the wordmark, cream/forest/gold and a small oymo rule.
 */
export type ShareCardVariant = 'story' | 'score' | 'journal' | 'badge' | 'creation';

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
  /** A short line the user typed for this card themselves (Journal) -
   * never filled in automatically from private text. */
  excerpt?: string | null;
  variant?: ShareCardVariant;
  /** `score` variant: the real figure (e.g. "4 / 5", "3 / 6"). */
  stat?: string | null;
  /** `journal` variant: the linked OYNO content's name. */
  linkedLabel?: string | null;
  /** `creation` variant: the user's design rendered live (SVG/views), and
   * its natural size so the card can scale it to fit. */
  artwork?: ReactNode;
  artworkSize?: { width: number; height: number };
};

type ShareCardProps = ShareCardContent & {
  onImageReady?: () => void;
};

/** No user data ever: no name, avatar, email, id, coordinates - only the
 * content being shared and what the user explicitly typed for the card. */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(props, ref) {
  const variant = props.variant ?? 'story';
  if (variant === 'journal') return <JournalCard ref={ref} {...props} />;
  if (variant === 'badge') return <BadgeCard ref={ref} {...props} />;
  if (variant === 'creation') return <CreationCard ref={ref} {...props} />;
  return <PhotoCard ref={ref} {...props} variant={variant} />;
});

const PhotoCard = forwardRef<View, ShareCardProps>(function PhotoCard(
  { title, label, imageSource, fallbackTone = colors.surfaceFeature, completedLabel, excerpt, variant, stat, onImageReady },
  ref,
) {
  const score = variant === 'score' && !!stat;
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
        colors={score ? ['rgba(19,32,24,0.45)', 'rgba(19,32,24,0.35)', 'rgba(19,32,24,0.6)', 'rgba(19,32,24,0.95)'] : ['rgba(19,32,24,0.35)', 'rgba(19,32,24,0)', 'rgba(19,32,24,0.2)', 'rgba(19,32,24,0.92)']}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Brand light />

      {score ? (
        <View style={styles.scoreCenter}>
          <Text style={styles.scoreValue} numberOfLines={1} adjustsFontSizeToFit>
            {stat}
          </Text>
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.title, score && styles.titleScore]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Text>
        {excerpt ? (
          <Text style={styles.excerpt} numberOfLines={3}>
            {`“${excerpt}”`}
          </Text>
        ) : null}
        {completedLabel ? (
          <View style={styles.completed}>
            <OymoOrnament size={10} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.completedText}>{completedLabel}</Text>
          </View>
        ) : null}
        <Rule />
      </View>
    </View>
  );
});

const JournalCard = forwardRef<View, ShareCardProps>(function JournalCard({ title, label, imageSource, excerpt, linkedLabel, onImageReady }, ref) {
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.paper]}>
      <View style={styles.frame}>
        {imageSource ? (
          <Image source={imageSource} style={styles.fill} resizeMode="cover" onLoad={onImageReady} onError={onImageReady} />
        ) : (
          <View style={[styles.fallbackMark, styles.frameFallback]}>
            <OymoOrnament size={90} color="rgba(232,185,61,0.35)" strokeWidth={1} />
          </View>
        )}
        <View style={styles.tape} />
      </View>
      <View style={styles.paperText}>
        <View style={styles.paperBrand}>
          <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
          <Text style={styles.paperLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.paperWordmark}>OYNO</Text>
        </View>
        <Text style={styles.paperTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </Text>
        {excerpt ? (
          <Text style={styles.paperExcerpt} numberOfLines={2}>
            {`“${excerpt}”`}
          </Text>
        ) : null}
        {linkedLabel ? (
          <Text style={styles.paperLinked} numberOfLines={1}>
            ◆ {linkedLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const BadgeCard = forwardRef<View, ShareCardProps>(function BadgeCard({ title, label, imageSource, completedLabel, onImageReady }, ref) {
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.badgeCard]}>
      <Brand light />
      <View style={styles.badgeHalo} />
      {imageSource ? <Image source={imageSource} style={styles.badgeArt} resizeMode="contain" onLoad={onImageReady} onError={onImageReady} /> : null}
      <View style={styles.badgeText}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.title, styles.badgeTitle]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </Text>
        {completedLabel ? <Text style={styles.badgeNote}>{completedLabel}</Text> : null}
        <Rule />
      </View>
    </View>
  );
});

const CREATION_FRAME = 240;

const CreationCard = forwardRef<View, ShareCardProps>(function CreationCard({ title, label, artwork, artworkSize }, ref) {
  const size = artworkSize ?? { width: CREATION_FRAME, height: CREATION_FRAME };
  const scale = Math.min(CREATION_FRAME / size.width, CREATION_FRAME / size.height);
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.paper, styles.creationCard]}>
      <View style={[styles.paperBrand, styles.creationBrand]}>
        <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
        <Text style={styles.paperLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.paperWordmark}>OYNO</Text>
      </View>
      <View style={styles.creationFrame}>
        <View style={{ width: size.width, height: size.height, transform: [{ scale }] }}>{artwork}</View>
      </View>
      <Text style={[styles.paperTitle, styles.creationTitle]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {title}
      </Text>
    </View>
  );
});

function Brand({ light }: { light: boolean }) {
  return (
    <View style={styles.brandRow}>
      <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.75} />
      <Text style={[styles.wordmark, !light && styles.wordmarkDark]}>OYNO</Text>
    </View>
  );
}

function Rule() {
  return (
    <View style={styles.footerRule}>
      <View style={styles.ruleLine} />
      <OymoOrnament size={8} color="rgba(232,185,61,0.8)" strokeWidth={1.5} />
      <View style={styles.ruleLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  fallbackMark: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  brandRow: { position: 'absolute', top: spacing.lg, left: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wordmark: { ...editorial(textStyles.title), fontSize: 18, letterSpacing: 3, color: colors.textOnDark },
  wordmarkDark: { color: colors.primary },
  content: { padding: spacing.lg, gap: spacing.xs },
  label: { ...textStyles.overline, color: colors.accentGold },
  title: { ...editorial(textStyles.display), fontSize: 34, lineHeight: 40, color: colors.textOnDark },
  titleScore: { fontSize: 26, lineHeight: 32 },
  excerpt: { ...textStyles.body, fontSize: 17, lineHeight: 24, fontStyle: 'italic', color: 'rgba(255,255,255,0.9)' },
  completed: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.accentGold, marginTop: spacing.xxs },
  completedText: { ...textStyles.small, color: colors.textPrimary },
  scoreCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  scoreValue: { ...editorial(textStyles.display), fontSize: 84, lineHeight: 92, color: colors.textOnDark, paddingHorizontal: spacing.lg },
  footerRule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  ruleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(232,185,61,0.5)' },
  badgeCard: { backgroundColor: colors.surfaceFeature, alignItems: 'center', justifyContent: 'flex-end' },
  badgeHalo: { position: 'absolute', top: 66, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(232,185,61,0.14)' },
  badgeArt: { position: 'absolute', top: 76, width: 210, height: 210 },
  badgeText: { alignSelf: 'stretch', padding: spacing.lg, gap: spacing.xs, alignItems: 'center' },
  badgeTitle: { textAlign: 'center', fontSize: 30, lineHeight: 36 },
  badgeNote: { ...textStyles.caption, color: colors.textOnDarkSecondary, textAlign: 'center' },
  // Journal: cream paper, framed picture with a strip of gold "tape".
  paper: { backgroundColor: colors.surfaceElevated, justifyContent: 'flex-start', padding: spacing.lg, gap: spacing.md },
  frame: { height: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceFeature, borderWidth: 5, borderColor: '#FFFDF7', transform: [{ rotate: '-1.5deg' }] },
  frameFallback: { backgroundColor: colors.surfaceFeature },
  tape: { position: 'absolute', top: -4, alignSelf: 'center', width: 70, height: 18, backgroundColor: 'rgba(232,185,61,0.6)', transform: [{ rotate: '2deg' }] },
  paperText: { flex: 1, gap: 6 },
  paperBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paperLabel: { ...textStyles.overline, color: colors.accentTerracotta, flex: 1 },
  paperWordmark: { ...editorial(textStyles.title), fontSize: 15, letterSpacing: 2.5, color: colors.primary },
  paperTitle: { ...editorial(textStyles.h1), color: colors.textPrimary },
  paperExcerpt: { ...textStyles.body, fontSize: 16, lineHeight: 22, fontStyle: 'italic', color: colors.textSecondary },
  creationCard: { alignItems: 'center', justifyContent: 'space-between' },
  creationFrame: { width: CREATION_FRAME + 24, height: CREATION_FRAME + 24, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFDF7', overflow: 'hidden' },
  creationTitle: { textAlign: 'center' },
  creationBrand: { alignSelf: 'stretch' },
  paperLinked: { ...textStyles.caption, fontWeight: '700', color: colors.primary, marginTop: 'auto' },
});
