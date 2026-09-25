import { GraduationCap, Lock, NotebookPen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { MediaImage } from '@/components/ui';
import { natureSiteImages } from '@/features/explore/data';
import { mockGamesList } from '@/features/games/mockData';
import { gameTitleKey } from '@/features/games/types';
import { profileAchievements } from '@/features/profile/data';
import { cardRadii, colors, elevation, radii, spacing, textStyles } from '@/theme';

/**
 * The three onboarding "story" compositions. Everything shown is real OYNO
 * content (destination photos, game covers, the Passport / Journal /
 * Achievement concepts) in a neutral state - no counts, scores or progress
 * that the new user doesn't have.
 */

type Tilt = { rotate: string; style: ViewStyle };

function PhotoCard({ source, label, width, height, tilt }: { source: ImageSourcePropType; label: string; width: number; height: number; tilt: Tilt }) {
  return (
    <View style={[styles.card, elevation.floating, { width, height, transform: [{ rotate: tilt.rotate }] }, tilt.style]}>
      <MediaImage source={source} />
      <View style={styles.cardLabel}>
        <OymoOrnament size={9} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={styles.cardLabelText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Discover: three real destinations as overlapping photo cards. */
export function DiscoverCollage({ width }: { width: number }) {
  const { t } = useTranslation();
  const cardW = Math.round(width * 0.5);
  const cardH = Math.round(cardW * 1.3);
  return (
    <View style={[styles.stage, { width, height: cardH + 60 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PhotoCard source={natureSiteImages['sary-chelek']} label={t('onboarding.v2.places.saryChelek')} width={cardW} height={cardH} tilt={{ rotate: '-7deg', style: { left: 0, top: 30 } }} />
      <PhotoCard source={natureSiteImages.alay} label={t('onboarding.v2.places.alay')} width={cardW} height={cardH} tilt={{ rotate: '6deg', style: { right: 0, top: 44 } }} />
      <PhotoCard source={natureSiteImages['son-kol']} label={t('onboarding.v2.places.sonKol')} width={cardW} height={cardH} tilt={{ rotate: '0deg', style: { left: (width - cardW) / 2, top: 0 } }} />
    </View>
  );
}

const PLAY_GAMES = ['kok-boru', 'chuko', 'ordo'] as const;

/** Play & learn: three real game covers + the knowledge-challenge concept. */
export function PlayCollage({ width }: { width: number }) {
  const { t } = useTranslation();
  const games = PLAY_GAMES.map((id) => mockGamesList.find((game) => game.id === id)).filter((game): game is NonNullable<typeof game> => !!game?.thumbnail);
  const bigW = Math.round(width * 0.56);
  const smallW = Math.round(width * 0.4);
  const [feature, ...rest] = games;
  return (
    <View style={[styles.stage, { width, height: Math.round(bigW * 1.25) + 40 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rest[0] ? <PhotoCard source={rest[0].thumbnail!} label={t(gameTitleKey(rest[0].id))} width={smallW} height={Math.round(smallW * 0.95)} tilt={{ rotate: '-5deg', style: { left: 0, top: 10 } }} /> : null}
      {rest[1] ? <PhotoCard source={rest[1].thumbnail!} label={t(gameTitleKey(rest[1].id))} width={smallW} height={Math.round(smallW * 0.95)} tilt={{ rotate: '5deg', style: { right: 0, top: Math.round(bigW * 0.62) } }} /> : null}
      {feature ? <PhotoCard source={feature.thumbnail!} label={t(gameTitleKey(feature.id))} width={bigW} height={Math.round(bigW * 1.25)} tilt={{ rotate: '0deg', style: { left: (width - bigW) / 2, top: 20 } }} /> : null}
      <View style={[styles.chip, elevation.floating, { left: spacing.sm, bottom: 0 }]}>
        <GraduationCap size={15} color={colors.textPrimary} strokeWidth={2.25} />
        <Text style={styles.chipText}>{t('onboarding.v2.challengeChip')}</Text>
      </View>
    </View>
  );
}

/** Your journey: Passport seals (neutral), a private Journal card and an
 * achievement medal - the concepts, never fake progress. */
export function JourneyCollage({ width }: { width: number }) {
  const { t } = useTranslation();
  const seal = Math.round(width * 0.17);
  const medal = profileAchievements[1] ?? profileAchievements[0];
  return (
    <View style={[styles.stage, { width, height: Math.round(width * 0.95) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.panel, elevation.floating, { left: 0, top: 0, width: width * 0.78, transform: [{ rotate: '-3deg' }] }]}>
        <Text style={styles.panelKicker}>{t('onboarding.v2.passport')}</Text>
        <View style={styles.seals}>
          {(['son-kol', 'sary-chelek', 'alay'] as const).map((id) => (
            <View key={id} style={[styles.seal, { width: seal, height: seal, borderRadius: seal / 2 }]}>
              <OymoOrnament size={Math.round(seal * 0.34)} color="rgba(139,107,61,0.55)" strokeWidth={1.5} />
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.panel, styles.journal, elevation.floating, { right: 0, top: Math.round(width * 0.36), width: width * 0.6, transform: [{ rotate: '4deg' }] }]}>
        <View style={styles.journalHead}>
          <NotebookPen size={18} color={colors.primary} strokeWidth={2} />
          <Text style={styles.panelTitle}>{t('onboarding.v2.journal')}</Text>
        </View>
        <View style={styles.lines}>
          <View style={[styles.line, { width: '92%' }]} />
          <View style={[styles.line, { width: '74%' }]} />
          <View style={[styles.line, { width: '84%' }]} />
        </View>
        <View style={styles.private}>
          <Lock size={11} color={colors.textMuted} strokeWidth={2.25} />
          <Text style={styles.privateText}>{t('onboarding.v2.private')}</Text>
        </View>
      </View>

      {medal ? <Image source={medal.iconSource} style={[styles.medal, { width: seal * 1.7, height: seal * 1.7, left: spacing.sm, bottom: 0 }]} resizeMode="contain" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'relative', alignSelf: 'center' },
  card: { position: 'absolute', borderRadius: cardRadii.media, overflow: 'hidden', backgroundColor: colors.surfaceFeature, borderWidth: 3, borderColor: colors.surfaceElevated },
  cardLabel: { position: 'absolute', left: spacing.xs, right: spacing.xs, bottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.chipOnDark },
  cardLabelText: { ...textStyles.small, color: colors.textOnDark, flexShrink: 1 },
  chip: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.accentGold },
  chipText: { ...textStyles.caption, fontWeight: '700', color: colors.textPrimary },
  panel: { position: 'absolute', padding: spacing.md, gap: spacing.sm, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  panelKicker: { ...textStyles.overline, color: colors.accentTerracotta },
  panelTitle: { ...textStyles.title, color: colors.textPrimary },
  seals: { flexDirection: 'row', gap: spacing.sm },
  seal: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(139,107,61,0.5)' },
  journal: { gap: spacing.xs },
  journalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lines: { gap: 7, paddingVertical: 4 },
  line: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted },
  private: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  privateText: { ...textStyles.small, color: colors.textMuted },
  medal: { position: 'absolute' },
});
