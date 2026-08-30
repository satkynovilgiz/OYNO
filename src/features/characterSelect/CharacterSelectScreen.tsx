import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ALL_CHARACTER_IDS,
  CHARACTERS_WITH_FULL_SHEET,
  CharacterAvatar,
  type CharacterId,
} from '@/components/character';
import { AnimatedPressable, Button } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type CharacterSelectScreenProps = {
  /** Guests can still pick a character locally; this just shows the
   * "create an account to save progress" hint per spec Section 2. */
  isGuest?: boolean;
  initialCharacterId?: CharacterId | null;
  onConfirm: (characterId: CharacterId) => void;
};

/**
 * "Каарманыңды танда" - shown after Sign Up and reachable from Profile.
 * Бек/Айдана/Аяна are fully selectable (happy portrait, descriptor, tap to
 * pick). Бөрү/Тулпар/Элчи have no sheet or portrait at all yet, so per
 * product decision they still appear in the grid (initial-letter
 * placeholder via CharacterAvatar) but as disabled "Жакында" cards rather
 * than being hidden.
 */
export function CharacterSelectScreen({ isGuest = false, initialCharacterId, onConfirm }: CharacterSelectScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CharacterId | null>(initialCharacterId ?? null);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.title}>{t('characterSelect.title')}</Text>
        <Text style={styles.subtitle}>{t('characterSelect.subtitle')}</Text>

        <View style={styles.grid}>
          {ALL_CHARACTER_IDS.map((characterId) => {
            const isComplete = CHARACTERS_WITH_FULL_SHEET.includes(characterId);
            const isSelected = isComplete && selected === characterId;

            const name = t(`character.names.${characterId}`);

            if (!isComplete) {
              return (
                <View
                  key={characterId}
                  accessibilityLabel={`${name} - ${t('characterSelect.comingSoon')}`}
                  style={[styles.card, styles.cardDisabled]}
                >
                  <View style={styles.avatarWrap}>
                    <CharacterAvatar characterId={characterId} emotion="happy" size={88} />
                  </View>
                  <Text style={styles.name}>{name}</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonLabel}>{t('characterSelect.comingSoon')}</Text>
                  </View>
                </View>
              );
            }

            return (
              <AnimatedPressable
                key={characterId}
                onPress={() => setSelected(characterId)}
                accessibilityRole="button"
                accessibilityLabel={name}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <View style={styles.avatarWrap}>
                  <CharacterAvatar characterId={characterId} emotion="happy" size={88} />
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.descriptor}>{t(`character.descriptors.${characterId}`)}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {isGuest && selected && <Text style={styles.guestHint}>{t('characterSelect.guestHint')}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={t('characterSelect.continue')}
          onPress={() => selected && onConfirm(selected)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  comingSoonBadge: {
    marginTop: spacing.xxs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  comingSoonLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
  },
  avatarWrap: {
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  descriptor: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  guestHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
});
