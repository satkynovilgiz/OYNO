import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { ProgressBar } from '@/components/ui';
import { formatDayLabel } from '@/features/daily/formatDayLabel';
import type { SupportedLanguage } from '@/i18n';
import type { AgeExperience } from '@/services/ageExperience/types';
import { localDateKey } from '@/services/daily/dailyDiscovery';
import { safeJsonParse } from '@/services/storage/safeJson';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import { newlyUnlockedStampIds, type Passport } from '../passport';
import { PassportStamp } from './PassportStamp';

/** Presentation-only memory of which stamps this device has already shown
 * unlocked - not progress (that stays in useProgressStore). */
const SEEN_KEY = 'oyno.passport.seenStamps';

const TILTS = ['-5deg', '4deg', '-3deg', '6deg', '-6deg', '3deg'];
const STAMP_SIZE: Record<AgeExperience, number> = { child: 108, preteen: 96, teen: 88, adult: 82 };
const COLUMNS: Record<AgeExperience, number> = { child: 2, preteen: 3, teen: 3, adult: 3 };

type PassportSectionProps = {
  passport: Passport;
  experience: AgeExperience;
};

/**
 * "Discovery Passport" page inside My Journey - one seal per real nature
 * destination (see passport.ts for the unlock rule). Honest count
 * ("2 / 6 Nature Sites discovered"), a gold completion band only when all
 * are genuinely visited (no invented reward), and each seal opens the real
 * destination detail screen.
 */
export function PassportSection({ passport, experience }: PassportSectionProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const [celebrateIds, setCelebrateIds] = useState<string[]>([]);
  const isAdult = experience === 'adult';

  const unlockedKey = passport.stamps.filter((stamp) => stamp.unlocked).map((stamp) => stamp.id).join(',');
  useEffect(() => {
    if (!unlockedKey) return;
    let cancelled = false;
    void (async () => {
      const raw = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      const seen = safeJsonParse<string[]>(raw, []);
      const fresh = newlyUnlockedStampIds(passport, Array.isArray(seen) ? seen : []);
      if (cancelled || fresh.length === 0) return;
      setCelebrateIds(fresh);
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(new Set([...(Array.isArray(seen) ? seen : []), ...fresh])))).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedKey]);

  if (passport.total === 0) return null;

  const columns = COLUMNS[experience];

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.crest}>
          <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.75} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{t('journey.passport.kicker')}</Text>
          <Text style={[styles.title, isAdult && styles.titleEditorial]}>{t('journey.passport.title')}</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>{t(`journey.passport.subtitle.${experience}`)}</Text>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{t('journey.passport.progress', { unlocked: passport.unlocked, total: passport.total })}</Text>
      </View>
      <ProgressBar progress={passport.unlocked / passport.total} height={5} fillColor={colors.accentGold} trackColor={colors.surfaceAlt} />

      <View style={styles.grid}>
        {passport.stamps.map((stamp, index) => (
          <View key={stamp.id} style={[styles.cell, { width: `${100 / columns}%` }]}>
            <PassportStamp
              stamp={stamp}
              size={STAMP_SIZE[experience]}
              tilt={TILTS[index % TILTS.length]}
              editorial={isAdult}
              celebrate={celebrateIds.includes(stamp.id)}
              dateLabel={stamp.visitedAt ? formatDayLabel(localDateKey(new Date(stamp.visitedAt)), language) : null}
              onPress={() => router.push(stamp.route as never)}
            />
          </View>
        ))}
      </View>

      {passport.isComplete ? (
        <View style={styles.complete}>
          <OymoOrnament size={14} color={colors.surfaceFeature} strokeWidth={2} />
          <View style={styles.completeText}>
            <Text style={styles.completeTitle}>{t('journey.passport.completeTitle')}</Text>
            <Text style={styles.completeBody}>{t('journey.passport.completeBody')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Passport pages are cream paper inside the dark-green cover - an inset
  // cream sheet with a gold hairline, distinct from the chapter pages.
  page: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(199,154,46,0.45)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crest: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceFeature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    ...typography.overline,
    color: colors.accentTerracotta,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  titleEditorial: {
    fontFamily: fontFamily.wordmark,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    marginTop: spacing.md,
  },
  cell: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
  },
  complete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accentGold,
  },
  completeText: {
    flex: 1,
  },
  completeTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  completeBody: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
