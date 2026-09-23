import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

/** Compact entry into /challenges - dropped into existing pages without
 * reshaping them. */
export function ChallengesEntryCard() {
  const { t } = useTranslation();
  return (
    <AnimatedPressable
      style={styles.card}
      onPress={() => router.push('/challenges' as never)}
      pressScale={0.98}
      hoverEffect
      accessibilityRole="button"
      accessibilityLabel={`${t('challenges.title')}. ${t('challenges.subtitle')}`}
    >
      <View style={styles.mark}>
        <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{t('challenges.title')}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {t('challenges.subtitle')}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.accentGold} strokeWidth={2.25} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xl, backgroundColor: colors.surfaceFeature },
  mark: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(232,185,61,0.5)', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...typography.h2, fontFamily: fontFamily.wordmark, color: colors.textOnDark },
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.72)' },
});
