import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, ProgressBar } from '@/components/ui';
import { LOCATION_TONES } from '@/features/explore/data';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import type { Passport } from '../passport';

/**
 * Compact Discovery Passport summary: real stamps unlocked / supported
 * destinations, a row of mini seals (photo seal when visited, dashed ghost
 * when not), the most recent real stamp, and "Open Passport". Count only -
 * never a percentage.
 */
export function PassportSummaryCard({ passport, editorialTitle = false, onPress }: { passport: Passport; editorialTitle?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const latest = passport.stamps
    .filter((stamp) => stamp.unlocked && stamp.visitedAt)
    .sort((a, b) => (b.visitedAt ?? '').localeCompare(a.visitedAt ?? ''))[0];
  const countLabel = t('journey.passport.progress', { unlocked: passport.unlocked, total: passport.total });

  return (
    <AnimatedPressable
      style={styles.card}
      onPress={onPress}
      press="soft"
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${t('journey.passport.title')}. ${countLabel}. ${t('explore.v2.passportCta')}`}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.kicker}>{t('journey.passport.kicker')}</Text>
          <Text style={[styles.title, editorialTitle ? editorial(textStyles.h3) : textStyles.h3]} numberOfLines={1}>
            {t('journey.passport.title')}
          </Text>
        </View>
        <Text style={styles.big}>
          {passport.unlocked}
          <Text style={styles.bigTotal}>/{passport.total}</Text>
        </Text>
      </View>

      <View style={styles.seals} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {passport.stamps.map((stamp) => (
          <View key={stamp.id} style={[styles.seal, stamp.unlocked ? { borderColor: LOCATION_TONES[stamp.toneIndex % LOCATION_TONES.length] } : styles.sealLocked]}>
            {stamp.unlocked && stamp.imageSource ? (
              <Image source={stamp.imageSource} style={styles.sealPhoto} resizeMode="cover" />
            ) : (
              <OymoOrnament size={14} color={stamp.unlocked ? colors.accentGoldPressed : 'rgba(139,107,61,0.35)'} strokeWidth={1.5} />
            )}
          </View>
        ))}
      </View>

      <ProgressBar progress={passport.total > 0 ? passport.unlocked / passport.total : 0} height={4} fillColor={colors.accentGold} trackColor={colors.surfaceMuted} />

      <View style={styles.footer}>
        <Text style={styles.note} numberOfLines={2}>
          {latest ? t('explore.v2.lastStamp', { title: latest.title }) : passport.unlocked === 0 ? t('explore.v2.passportEmpty') : countLabel}
        </Text>
        <Text style={styles.cta}>{t('explore.v2.passportCta')} ›</Text>
      </View>
    </AnimatedPressable>
  );
}

const SEAL = 38;

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: cardRadii.media, backgroundColor: colors.surfaceElevated },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  headText: { flex: 1, gap: 2, minWidth: 0 },
  kicker: { ...textStyles.overline, color: colors.accentTerracotta },
  title: { color: colors.textPrimary },
  big: { ...textStyles.h2, color: colors.primary },
  bigTotal: { ...textStyles.title, color: colors.textMuted },
  seals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  seal: { width: SEAL, height: SEAL, borderRadius: SEAL / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  sealLocked: { borderStyle: 'dashed', borderColor: 'rgba(139,107,61,0.45)', backgroundColor: 'transparent' },
  sealPhoto: { width: '100%', height: '100%' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  note: { ...textStyles.caption, color: colors.textSecondary, flexShrink: 1 },
  cta: { ...textStyles.caption, fontWeight: '700', color: colors.primary, flexShrink: 0 },
});
