import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character';
import { resolveCompanion } from '@/components/companion/companionModel';
import { AnimatedPressable, MediaImage, ProgressBar } from '@/components/ui';
import type { SupportedLanguage } from '@/i18n';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

import type { QuestProgress } from './questProgress';

/** Title, theme, the guide, real progress (X/Y) and one action. No time
 * estimate - there is no honest one to give. */
export function QuestCard({ progress, large = false, onPress }: { progress: QuestProgress; large?: boolean; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { quest, completed, total, status } = progress;
  const guide = resolveCompanion(quest.guide);
  const title = quest.title[language] ?? quest.title.kg;
  const action = status === 'completed' ? t('quests.view') : status === 'active' ? t('quests.continue') : t('quests.start');

  return (
    <AnimatedPressable
      style={[styles.card, large && styles.cardLarge]}
      onPress={onPress}
      press="soft"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${quest.theme[language] ?? quest.theme.kg}. ${t('quests.progress', { completed, total })}. ${action}`}
    >
      <View style={[styles.art, large && styles.artLarge]}>
        {quest.heroImage ? <MediaImage source={quest.heroImage} /> : null}
        <View style={styles.guide}>
          <CharacterAvatar characterId={guide} emotion="happy" size={large ? 44 : 36} />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.theme} numberOfLines={1}>
          {quest.theme[language] ?? quest.theme.kg}
        </Text>
        <Text style={[styles.title, large && styles.titleLarge]} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.bar}>
            <ProgressBar progress={total > 0 ? completed / total : 0} height={6} fillColor={status === 'completed' ? colors.accentGold : colors.primary} />
          </View>
          <Text style={styles.count}>{t('quests.progress', { completed, total })}</Text>
        </View>
        <Text style={styles.action}>{action} →</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.xs, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardLarge: { flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: cardRadii.media },
  art: { width: 96, height: 96, borderRadius: cardRadii.chip, overflow: 'hidden', backgroundColor: colors.surfaceFeature },
  artLarge: { width: '100%', height: 150, borderRadius: 0 },
  guide: { position: 'absolute', left: 6, bottom: 6, borderRadius: 999, borderWidth: 2, borderColor: colors.surfaceElevated },
  body: { flex: 1, gap: 3, padding: spacing.xs },
  theme: { ...textStyles.overline, fontSize: 11, color: colors.accentTerracotta },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  titleLarge: { ...editorial(textStyles.h2), color: colors.textPrimary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  bar: { flex: 1 },
  count: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  action: { ...textStyles.small, fontWeight: '700', color: colors.primary, marginTop: 2 },
});
