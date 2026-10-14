import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { CARD_FIT, fitCardText, type FitRole } from '@/components/share/cardFit';
import { CARD_STYLES, defaultStyle, type CardStyleId } from '@/components/share/cardContent';
import { colors, editorial, overlays, spacing, textStyles } from '@/theme';

/** Logical size of the card - captured at 1080×1350 physical (4:5 post). */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;

/** Logical size of this card: 360 x 450, or a postcard's own size. */
export function shareCardSize(content: Pick<ShareCardContent, 'variant' | 'cardSize'>): { width: number; height: number } {
  return content.variant === 'postcard' && content.cardSize ? content.cardSize : { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT };
}

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
 *   postcard a card the user composed themselves (Oymo postcard): the
 *            `artwork` IS the whole card, at `cardSize` - no wordmark,
 *            label or title is added, so only what they chose is shown
 *   summary  a short list of REAL counts the user chose to share (Learning
 *            Portfolio, Game Stats) + featured titles - never a rank,
 *            score total or anything about the person
 * All share the wordmark, cream/forest/gold and a small oymo rule.
 */
export type ShareCardVariant = 'story' | 'score' | 'journal' | 'badge' | 'creation' | 'summary' | 'postcard';

export type ShareCardContent = {
  title: string;
  /** Small category label, e.g. "Табигый жер" / "Маданият". */
  label: string;
  /** A short public line about the content (e.g. a destination's tagline). */
  subtitle?: string | null;
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
  /** `postcard` variant: the card's own logical size (default 360 x 450);
   * exported at 3x. */
  cardSize?: { width: number; height: number };
  /** `summary` variant: up to 4 real figure lines ("3 Learning Paths"). */
  lines?: string[];
  /** `summary` variant: up to 3 featured content titles. */
  featured?: string[];
  /** `summary` variant: heading above the featured titles. */
  featuredLabel?: string | null;
  /** `creation` / `summary`: one of the OYNO card styles (cardContent.ts CARD_STYLES). */
  cardStyle?: CardStyleId;
};

type ShareCardProps = ShareCardContent & {
  onImageReady?: () => void;
};

/** No user data ever: no name, avatar, email, id, coordinates - only the
 * content being shared and what the user explicitly typed for the card.
 * (useShareCard filters every card to its approved fields first: cardContent.ts.) */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(props, ref) {
  const variant = props.variant ?? 'story';
  if (variant === 'journal') return <JournalCard ref={ref} {...props} />;
  if (variant === 'badge') return <BadgeCard ref={ref} {...props} />;
  if (variant === 'creation') return <CreationCard ref={ref} {...props} />;
  if (variant === 'summary') return <SummaryCard ref={ref} {...props} />;
  if (variant === 'postcard') {
    const size = shareCardSize(props);
    return (
      <View ref={ref} collapsable={false} style={{ width: size.width, height: size.height, overflow: 'hidden' }} testID="share-card-postcard">
        {props.artwork}
      </View>
    );
  }
  return <PhotoCard ref={ref} {...props} variant={variant} />;
});

/* ---------- shared layout primitives (every card is built from these) ---------- */

/** Cards have a fixed logical size and are captured at 3x: system font scaling would change the export. */
const FIXED = { allowFontScaling: false, maxFontSizeMultiplier: 1 } as const;

/** Text fitted by the ONE rule (cardFit.ts) - the same in the preview and the exported image. */
export function CardText({ text, role, style, testID }: { text: string; role: FitRole; style: object | object[]; testID?: string }) {
  const fit = fitCardText(text, role);
  return (
    <Text {...FIXED} style={[style, { fontSize: fit.fontSize, lineHeight: fit.lineHeight }]} numberOfLines={role.maxLines} testID={testID}>
      {fit.text}
    </Text>
  );
}
const isShortened = (entries: [string | null | undefined, FitRole][]) => entries.some(([text, role]) => !!text && fitCardText(text, role).shortened);

/** "Shortened to fit the card" - shown on the card itself whenever the fit rule had to cut text. */
function ShortenedNote({ show, color }: { show: boolean; color: string }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <Text {...FIXED} style={[styles.shortened, { color }]} testID="share-card-shortened">
      {t('shareCards.shortened')}
    </Text>
  );
}

/** Attribution: oymo mark + the content's label + the OYNO wordmark. */
function CardAttribution({ label, labelColor, wordmarkColor, ornamentColor }: { label: string; labelColor: string; wordmarkColor: string; ornamentColor: string }) {
  return (
    <View style={styles.attribution}>
      <OymoOrnament size={10} color={ornamentColor} strokeWidth={1.75} />
      <Text {...FIXED} style={[styles.attributionLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      <Text {...FIXED} style={[styles.attributionWordmark, { color: wordmarkColor }]}>
        OYNO
      </Text>
    </View>
  );
}

/** The artwork, whole: scaled to fit its frame, never cropped. */
function CardArtwork({ children, natural, frame, frameColor }: { children: ReactNode; natural: { width: number; height: number }; frame: number; frameColor: string }) {
  const scale = Math.min(frame / natural.width, frame / natural.height);
  return (
    <View style={[styles.artworkFrame, { width: frame + 24, height: frame + 24, backgroundColor: frameColor }]} testID="share-card-artwork">
      <View style={{ width: natural.width, height: natural.height, transform: [{ scale }] }}>{children}</View>
    </View>
  );
}

function Brand({ light }: { light: boolean }) {
  return (
    <View style={styles.brandRow}>
      <OymoOrnament size={12} color={colors.accentGold} strokeWidth={1.75} />
      <Text {...FIXED} style={[styles.wordmark, !light && styles.wordmarkDark]}>
        OYNO
      </Text>
    </View>
  );
}

function Rule({ color = 'rgba(232,185,61,0.5)' }: { color?: string }) {
  return (
    <View style={styles.footerRule}>
      <View style={[styles.ruleLine, { backgroundColor: color }]} />
      <OymoOrnament size={8} color="rgba(232,185,61,0.8)" strokeWidth={1.5} />
      <View style={[styles.ruleLine, { backgroundColor: color }]} />
    </View>
  );
}

/* ---------- the card types (each keeps its own layout) ---------- */

const PhotoCard = forwardRef<View, ShareCardProps>(function PhotoCard(
  { title, label, subtitle, imageSource, fallbackTone = colors.surfaceFeature, completedLabel, excerpt, variant, stat, onImageReady },
  ref,
) {
  const score = variant === 'score' && !!stat;
  const titleRole = score ? CARD_FIT.scoreTitle : CARD_FIT.heroTitle;
  const shortened = isShortened([
    [title, titleRole],
    [subtitle, CARD_FIT.line],
    [excerpt ? `“${excerpt}”` : null, CARD_FIT.line],
  ]);
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: fallbackTone }]} testID={`share-card-${variant ?? 'story'}`}>
      {imageSource ? (
        <Image source={imageSource} style={styles.fill} resizeMode="cover" onLoad={onImageReady} onError={onImageReady} />
      ) : (
        <View style={styles.fallbackMark}>
          <OymoOrnament size={120} color="rgba(255,255,255,0.14)" strokeWidth={1} />
        </View>
      )}
      <LinearGradient
        colors={score ? [overlays.medium, overlays.soft, 'rgba(19,32,24,0.6)', 'rgba(19,32,24,0.95)'] : [overlays.soft, overlays.clear, 'rgba(19,32,24,0.2)', 'rgba(19,32,24,0.92)']}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Brand light />

      {score ? (
        <View style={styles.scoreCenter}>
          <Text {...FIXED} style={styles.scoreValue} numberOfLines={1}>
            {stat}
          </Text>
        </View>
      ) : null}

      <View style={styles.content}>
        <Text {...FIXED} style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <CardText text={title} role={titleRole} style={styles.title} testID="share-card-title" />
        {subtitle ? <CardText text={subtitle} role={CARD_FIT.line} style={styles.subtitle} /> : null}
        {excerpt ? <CardText text={`“${excerpt}”`} role={CARD_FIT.line} style={styles.excerpt} /> : null}
        {completedLabel ? (
          <View style={styles.completed}>
            <OymoOrnament size={10} color={colors.textPrimary} strokeWidth={2} />
            <Text {...FIXED} style={styles.completedText}>
              {completedLabel}
            </Text>
          </View>
        ) : null}
        <ShortenedNote show={shortened} color={colors.textOnDarkSecondary} />
        <Rule />
      </View>
    </View>
  );
});

const JournalCard = forwardRef<View, ShareCardProps>(function JournalCard({ title, label, imageSource, excerpt, linkedLabel, onImageReady }, ref) {
  const paper = CARD_STYLES.paper;
  const shortened = isShortened([
    [title, CARD_FIT.paperTitle],
    [excerpt ? `“${excerpt}”` : null, CARD_FIT.line],
  ]);
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.paper, { backgroundColor: paper.background }]} testID="share-card-journal">
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
        <CardAttribution label={label} labelColor={paper.label} wordmarkColor={paper.wordmark} ornamentColor={colors.accentGoldPressed} />
        <CardText text={title} role={CARD_FIT.paperTitle} style={[styles.paperTitle, { color: paper.ink }]} testID="share-card-title" />
        {excerpt ? <CardText text={`“${excerpt}”`} role={CARD_FIT.line} style={[styles.paperExcerpt, { color: paper.inkSoft }]} /> : null}
        <ShortenedNote show={shortened} color={paper.inkSoft} />
        {linkedLabel ? (
          <Text {...FIXED} style={styles.paperLinked} numberOfLines={1}>
            ◆ {linkedLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const BadgeCard = forwardRef<View, ShareCardProps>(function BadgeCard({ title, label, imageSource, completedLabel, onImageReady }, ref) {
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.badgeCard]} testID="share-card-badge">
      <Brand light />
      <View style={styles.badgeHalo} />
      {imageSource ? <Image source={imageSource} style={styles.badgeArt} resizeMode="contain" onLoad={onImageReady} onError={onImageReady} /> : null}
      <View style={styles.badgeText}>
        <Text {...FIXED} style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <CardText text={title} role={CARD_FIT.centerTitle} style={[styles.title, styles.centered]} testID="share-card-title" />
        {completedLabel ? (
          <Text {...FIXED} style={styles.badgeNote}>
            {completedLabel}
          </Text>
        ) : null}
        <ShortenedNote show={isShortened([[title, CARD_FIT.centerTitle]])} color={colors.textOnDarkSecondary} />
        <Rule />
      </View>
    </View>
  );
});

const CREATION_FRAME = 240;

const CreationCard = forwardRef<View, ShareCardProps>(function CreationCard({ title, label, artwork, artworkSize, cardStyle }, ref) {
  const tone = CARD_STYLES[cardStyle ?? defaultStyle('creation')];
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.paper, styles.creationCard, { backgroundColor: tone.background }]} testID={`share-card-creation-${cardStyle ?? defaultStyle('creation')}`}>
      <CardAttribution label={label} labelColor={tone.label} wordmarkColor={tone.wordmark} ornamentColor={colors.accentGoldPressed} />
      <CardArtwork natural={artworkSize ?? { width: CREATION_FRAME, height: CREATION_FRAME }} frame={CREATION_FRAME} frameColor={tone.frame}>
        {artwork}
      </CardArtwork>
      <View style={styles.creationFooter}>
        <CardText text={title} role={CARD_FIT.paperTitle} style={[styles.paperTitle, styles.centered, { color: tone.ink }]} testID="share-card-title" />
        <ShortenedNote show={isShortened([[title, CARD_FIT.paperTitle]])} color={tone.inkSoft} />
      </View>
    </View>
  );
});

const SummaryCard = forwardRef<View, ShareCardProps>(function SummaryCard({ title, label, lines = [], featured = [], featuredLabel, cardStyle }, ref) {
  const tone = CARD_STYLES[cardStyle ?? defaultStyle('summary')];
  const shown = lines.slice(0, 4);
  const names = featured.slice(0, 3);
  const shortened = isShortened([[title, CARD_FIT.centerTitle], ...shown.map((line) => [line, CARD_FIT.figure] as [string, FitRole]), ...names.map((name) => [`◆ ${name}`, { ...CARD_FIT.line, maxLines: 1 }] as [string, FitRole])]);
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: tone.background }]} testID={`share-card-summary-${cardStyle ?? defaultStyle('summary')}`}>
      <View style={styles.summaryTop}>
        <CardAttribution label={label} labelColor={tone.label} wordmarkColor={tone.wordmark} ornamentColor={colors.accentGold} />
      </View>
      <View style={styles.summaryBody}>
        <CardText text={title} role={CARD_FIT.centerTitle} style={[styles.title, { color: tone.ink, marginBottom: spacing.xs }]} testID="share-card-title" />
        {shown.map((line) => (
          <CardText key={line} text={line} role={CARD_FIT.figure} style={[styles.summaryLine, { color: tone.ink }]} />
        ))}
        {names.length > 0 ? (
          <View style={styles.summaryFeatured}>
            {featuredLabel ? (
              <Text {...FIXED} style={[styles.label, { color: tone.label }]}>
                {featuredLabel}
              </Text>
            ) : null}
            {names.map((name) => (
              <CardText key={name} text={`◆ ${name}`} role={{ ...CARD_FIT.line, maxLines: 1 }} style={[styles.summaryFeaturedItem, { color: tone.inkSoft }]} />
            ))}
          </View>
        ) : null}
        <ShortenedNote show={shortened} color={tone.inkSoft} />
        <Rule color={tone.rule} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  fallbackMark: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  brandRow: { position: 'absolute', top: spacing.lg, left: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wordmark: { ...editorial(textStyles.title), fontSize: 18, letterSpacing: 3, color: colors.textOnDark },
  wordmarkDark: { color: colors.primary },
  content: { padding: spacing.lg, gap: spacing.xs },
  label: { ...textStyles.overline, color: colors.accentGold },
  title: { ...editorial(textStyles.display), color: colors.textOnDark },
  centered: { textAlign: 'center' },
  subtitle: { ...textStyles.body, color: 'rgba(255,255,255,0.88)' },
  excerpt: { ...textStyles.body, fontStyle: 'italic', color: 'rgba(255,255,255,0.9)' },
  shortened: { ...textStyles.small, fontStyle: 'italic' },
  completed: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.accentGold, marginTop: spacing.xxs },
  completedText: { ...textStyles.small, color: colors.textPrimary },
  scoreCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  scoreValue: { ...editorial(textStyles.display), fontSize: 84, lineHeight: 92, color: colors.textOnDark, paddingHorizontal: spacing.lg },
  footerRule: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  ruleLine: { flex: 1, height: StyleSheet.hairlineWidth },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  attributionLabel: { ...textStyles.overline, flex: 1 },
  attributionWordmark: { ...editorial(textStyles.title), fontSize: 15, letterSpacing: 2.5 },
  artworkFrame: { alignItems: 'center', justifyContent: 'center', borderRadius: 18, overflow: 'hidden' },
  badgeCard: { backgroundColor: colors.surfaceFeature, alignItems: 'center', justifyContent: 'flex-end' },
  badgeHalo: { position: 'absolute', top: 66, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(232,185,61,0.14)' },
  badgeArt: { position: 'absolute', top: 76, width: 210, height: 210 },
  badgeText: { alignSelf: 'stretch', padding: spacing.lg, gap: spacing.xs, alignItems: 'center' },
  badgeNote: { ...textStyles.caption, color: colors.textOnDarkSecondary, textAlign: 'center' },
  // Journal: cream paper, framed picture with a strip of gold "tape".
  paper: { justifyContent: 'flex-start', padding: spacing.lg, gap: spacing.md },
  frame: { height: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surfaceFeature, borderWidth: 5, borderColor: '#FFFDF7', transform: [{ rotate: '-1.5deg' }] },
  frameFallback: { backgroundColor: colors.surfaceFeature },
  tape: { position: 'absolute', top: -4, alignSelf: 'center', width: 70, height: 18, backgroundColor: 'rgba(232,185,61,0.6)', transform: [{ rotate: '2deg' }] },
  paperText: { flex: 1, gap: 6 },
  paperTitle: { ...editorial(textStyles.h1) },
  paperExcerpt: { ...textStyles.body, fontStyle: 'italic' },
  paperLinked: { ...textStyles.caption, fontWeight: '700', color: colors.primary, marginTop: 'auto' },
  creationCard: { alignItems: 'center', justifyContent: 'space-between' },
  creationFooter: { alignSelf: 'stretch', gap: 2 },
  summaryTop: { position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg },
  summaryBody: { padding: spacing.lg, gap: spacing.xs },
  summaryLine: { ...editorial(textStyles.title) },
  summaryFeatured: { gap: 4, marginTop: spacing.sm },
  summaryFeaturedItem: { ...textStyles.body },
});
