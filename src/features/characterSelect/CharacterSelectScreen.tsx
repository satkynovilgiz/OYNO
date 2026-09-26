import { Check, ChevronLeft, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALL_CHARACTER_IDS, CharacterAvatar, type CharacterId } from '@/components/character';
import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { isSelectableCompanion } from '@/features/profileSetup/profileSetupModel';
import { SetupSteps } from '@/features/profileSetup/SetupSteps';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

type CharacterSelectScreenProps = {
  /** `setup` = step 2 of profile setup; `change` = Settings > Story
   * Companion (replaces the companion only - avatar/progress untouched). */
  context?: 'setup' | 'change';
  setupStep?: number;
  /** Guests can still pick a guide locally; shows the save hint. */
  isGuest?: boolean;
  initialCharacterId?: CharacterId | null;
  onConfirm: (characterId: CharacterId) => void;
  onBack?: () => void;
};

/**
 * Story Companion = the OYNO guide who shows up in stories, trails and
 * games. It is NOT the user's avatar (that is the next step / its own
 * editor). Бек/Айдана/Аяна are selectable; Бөрү/Тулпар/Элчи have no
 * complete character sheet yet, so they stay visible but disabled
 * "Coming soon" - never selectable with placeholder art.
 */
export function CharacterSelectScreen({ context = 'change', setupStep, isGuest = false, initialCharacterId, onConfirm, onBack }: CharacterSelectScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { experience } = useAgeExperience();
  const [selected, setSelected] = useState<CharacterId | null>(isSelectableCompanion(initialCharacterId) ? initialCharacterId : null);
  const portrait = experience === 'child' ? 104 : 88;
  const isSetup = context === 'setup';
  const canConfirm = isSelectableCompanion(selected);

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.topRow}>
          {onBack ? <IconButton icon={ChevronLeft} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} onPress={onBack} /> : null}
          {setupStep ? <SetupSteps current={setupStep} /> : null}
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {t(isSetup ? 'profileSetup.v2.guide.title' : 'characterSelect.title')}
        </Text>
        <Text style={styles.subtitle}>{t(isSetup ? 'profileSetup.v2.guide.body' : 'characterSelect.subtitle')}</Text>

        <View style={styles.grid}>
          {ALL_CHARACTER_IDS.map((characterId) => {
            const available = isSelectableCompanion(characterId);
            const isSelected = available && selected === characterId;
            const name = t(`character.names.${characterId}`);

            if (!available) {
              return (
                <View
                  key={characterId}
                  accessible
                  accessibilityLabel={`${name}, ${t('characterSelect.comingSoon')}`}
                  accessibilityState={{ disabled: true }}
                  style={[styles.card, styles.cardDisabled]}
                >
                  <View style={styles.portraitWrap}>
                    <CharacterAvatar characterId={characterId} emotion="happy" size={portrait * 0.8} />
                  </View>
                  <Text style={styles.name}>{name}</Text>
                  <View style={styles.soonBadge}>
                    <Lock size={11} color={colors.textMuted} strokeWidth={2.5} />
                    <Text style={styles.soonLabel}>{t('characterSelect.comingSoon')}</Text>
                  </View>
                </View>
              );
            }

            const descriptor = t(`character.descriptors.${characterId}`);
            return (
              <AnimatedPressable
                key={characterId}
                onPress={() => setSelected(characterId)}
                press="soft"
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, checked: isSelected }}
                accessibilityLabel={`${name}, ${descriptor}`}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <View style={[styles.portraitWrap, isSelected && styles.portraitSelected]}>
                  <CharacterAvatar characterId={characterId} emotion="happy" size={portrait} />
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.descriptor} numberOfLines={2}>
                  {descriptor}
                </Text>
                {/* Selected is spelled out, not only shown by colour. */}
                <Text style={[styles.selectedLabel, !isSelected && styles.hidden]}>{t('profileSetup.v2.guide.selected')}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {isGuest && selected ? <Text style={styles.hint}>{t('characterSelect.guestHint')}</Text> : null}
        {!isSetup ? <Text style={styles.hint}>{t('profileSetup.v2.guide.changeNote')}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={t(isSetup ? 'profileSetup.continue' : 'profileSetup.v2.guide.save')}
          size="lg"
          block
          disabled={!canConfirm}
          onPress={() => canConfirm && selected && onConfirm(selected)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary, marginTop: spacing.xs },
  subtitle: { ...textStyles.body, color: colors.textSecondary, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 104,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: cardRadii.compact,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  cardSelected: { borderColor: colors.accentGold, backgroundColor: '#FFF8E6' },
  cardDisabled: { opacity: 0.6 },
  portraitWrap: { borderRadius: 999, padding: 3 },
  portraitSelected: { backgroundColor: colors.accentGold },
  checkBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surfaceElevated },
  name: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xxs },
  descriptor: { ...textStyles.small, color: colors.textSecondary, textAlign: 'center' },
  selectedLabel: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  hidden: { opacity: 0 },
  soonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingVertical: 2, paddingHorizontal: spacing.xs, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  soonLabel: { ...textStyles.small, color: colors.textMuted, fontWeight: '700' },
  hint: { ...textStyles.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.background },
});
