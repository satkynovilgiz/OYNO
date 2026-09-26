import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character';
import { Button } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { track } from '@/services/analytics/analytics';
import { useAppStore } from '@/store/useAppStore';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

import { COMPANION_LINES, companionLineKey, companionVisible, emotionFor, resolveCompanion, type CompanionMomentType } from './companionModel';

/**
 * A compact guide moment: the Story Companion's portrait (right emotion for
 * the moment), one short authored line, and an optional action. Never a
 * speech bubble over content, never animated for attention, no haptic of
 * its own. Read by screen readers as "<name>: <line>" once - the portrait
 * itself is decorative.
 */
export function CompanionMoment({
  characterId,
  moment,
  message,
  ctaLabel,
  onPressCta,
}: {
  characterId: string | null | undefined;
  moment: CompanionMomentType;
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}) {
  const { t } = useTranslation();
  const { experience } = useAgeExperience();
  const guide = resolveCompanion(characterId);
  const name = t(`character.names.${guide}`);
  const portrait = experience === 'child' ? 64 : experience === 'adult' ? 44 : 52;

  return (
    <View style={styles.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <CharacterAvatar characterId={guide} emotion={emotionFor(moment)} size={portrait} />
      </View>
      <View style={styles.text} accessible accessibilityLabel={`${name}: ${message}`}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.message, experience === 'child' && styles.messageChild]}>{message}</Text>
      </View>
      {ctaLabel && onPressCta ? <Button label={ctaLabel} size="sm" variant="secondary" onPress={onPressCta} /> : null}
    </View>
  );
}

/**
 * The player's own chosen companion at a story moment: shown only where
 * their age experience allows, speaking the authored line for this
 * surface. Analytics carry only the companion id, surface and moment.
 */
export function StoryCompanion({
  surface,
  moment,
  ctaLabel,
  onPressCta,
}: {
  surface: keyof typeof COMPANION_LINES;
  moment: CompanionMomentType;
  ctaLabel?: string;
  onPressCta?: () => void;
}) {
  const { t } = useTranslation();
  const { experience } = useAgeExperience();
  const companion = resolveCompanion(useAppStore((state) => state.characterId));
  const lineKey = companionLineKey(surface, moment);
  const visible = !!lineKey && companionVisible(experience, surface);

  useEffect(() => {
    if (visible) track('companion_moment_shown', { companionId: companion, surface, moment });
  }, [visible, companion, surface, moment]);

  if (!visible || !lineKey) return null;
  return <CompanionMoment characterId={companion} moment={moment} message={t(lineKey)} ctaLabel={ctaLabel} onPressCta={onPressCta} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  text: { flex: 1, gap: 2 },
  name: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracotta },
  message: { ...textStyles.body, color: colors.textPrimary },
  messageChild: { fontSize: 18, lineHeight: 25 },
});
