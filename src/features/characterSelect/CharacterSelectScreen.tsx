import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CHARACTER_DESCRIPTORS,
  CHARACTER_NAMES,
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
 * Only Бек/Айдана/Аяна are shown: Бөрү/Тулпар/Элчи have no sheet or
 * portrait at all yet, and per an explicit product decision they're hidden
 * entirely from this grid until their assets exist, rather than shown as
 * a "coming soon" placeholder.
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
          {CHARACTERS_WITH_FULL_SHEET.map((characterId) => {
            const isSelected = selected === characterId;
            return (
              <AnimatedPressable
                key={characterId}
                onPress={() => setSelected(characterId)}
                accessibilityRole="button"
                accessibilityLabel={CHARACTER_NAMES[characterId]}
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
                <Text style={styles.name}>{CHARACTER_NAMES[characterId]}</Text>
                <Text style={styles.descriptor}>{CHARACTER_DESCRIPTORS[characterId]}</Text>
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
    borderColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.primary,
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
