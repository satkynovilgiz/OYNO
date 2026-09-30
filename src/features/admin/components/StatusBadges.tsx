import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

import type { Coverage, LanguageCoverage, VerificationLevel } from '../adminModel';

const COVERAGE_STYLE: Record<Coverage, { bg: string; fg: string; mark: string }> = {
  complete: { bg: 'rgba(47,82,51,0.14)', fg: colors.primary, mark: '✓' },
  partial: { bg: 'rgba(199,154,46,0.2)', fg: colors.accentBrown, mark: '½' },
  missing: { bg: colors.surfaceAlt, fg: colors.textMuted, mark: '–' },
};

const VERIFICATION_LABEL: Record<VerificationLevel, string> = { verified: 'Verified', partially_verified: 'Partial', unverified: 'Unverified' };

/** KG / RU / EN coverage as three tiny chips - shape + text, not colour alone. */
export function CoverageBadges({ coverage }: { coverage: LanguageCoverage }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`KG ${coverage.kg}, RU ${coverage.ru}, EN ${coverage.en}`}>
      {(['kg', 'ru', 'en'] as const).map((language) => {
        const style = COVERAGE_STYLE[coverage[language]];
        return (
          <View key={language} style={[styles.chip, { backgroundColor: style.bg }]}>
            <Text style={[styles.chipText, { color: style.fg }]}>
              {language.toUpperCase()} {style.mark}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  return (
    <View style={[styles.chip, level === 'verified' ? styles.verified : level === 'partially_verified' ? styles.partial : styles.unverified]}>
      <Text style={styles.chipText}>{VERIFICATION_LABEL[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  chipText: { ...typography.small, fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  verified: { backgroundColor: 'rgba(47,82,51,0.14)' },
  partial: { backgroundColor: 'rgba(199,154,46,0.2)' },
  unverified: { backgroundColor: colors.surfaceAlt, marginRight: spacing.xxs },
});
