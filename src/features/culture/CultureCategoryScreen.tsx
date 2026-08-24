import { BookOpen, Flame, PartyPopper, Repeat, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable } from '@/components/ui';
import { SettingsScreenLayout } from '@/features/settings/components/SettingsScreenLayout';
import type { CultureItemRow, CultureItemTypeLabel } from '@/services/content/types';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type CultureCategoryScreenProps = {
  categoryTitle: string;
  items: CultureItemRow[];
  isLoading: boolean;
  hasError: boolean;
  onPressBack: () => void;
  onPressItem: (item: CultureItemRow) => void;
};

/** Per-item photography doesn't exist yet (only one image per whole
 * category), so item cards can't show a real photo without every card in a
 * category looking identical. A colored icon tile keyed off `type_label`
 * instead - distinct, meaningful, and doesn't fake photography we don't
 * have. */
const TYPE_ICON: Record<CultureItemTypeLabel, LucideIcon> = {
  custom: BookOpen,
  practice: Repeat,
  ritual: Flame,
  ceremony: Users,
  festival: PartyPopper,
};

const TYPE_COLOR: Record<CultureItemTypeLabel, string> = {
  custom: colors.accentBrown,
  practice: colors.primary,
  ritual: colors.danger,
  ceremony: colors.accentGold,
  festival: colors.discovery.animals,
};

/** Groups items by subgroup only when there's more than one distinct
 * subgroup present - a single-subgroup category (or one with no subgroup
 * at all) just renders a flat list instead of a redundant one-section
 * header. */
export function CultureCategoryScreen({
  categoryTitle,
  items,
  isLoading,
  hasError,
  onPressBack,
  onPressItem,
}: CultureCategoryScreenProps) {
  const { t } = useTranslation();

  const subgroups = Array.from(new Set(items.map((item) => item.subgroup ?? '')));
  const showSubgroupHeaders = subgroups.length > 1;

  return (
    <SettingsScreenLayout title={categoryTitle} onPressBack={onPressBack}>
      {isLoading ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : hasError ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>{t('culture.loadError')}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>{t('culture.item.pendingResearch')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {subgroups.map((subgroup) => {
            const groupItems = items.filter((item) => (item.subgroup ?? '') === subgroup);
            return (
              <View key={subgroup || 'default'} style={styles.group}>
                {showSubgroupHeaders && subgroup ? (
                  <Text style={styles.groupTitle}>{t(`culture.subgroups.${subgroup}`)}</Text>
                ) : null}
                <View style={styles.itemGrid}>
                  {groupItems.map((item) => {
                    const TileIcon = item.type_label ? TYPE_ICON[item.type_label] : null;
                    const tileColor = item.type_label ? TYPE_COLOR[item.type_label] : colors.textMuted;

                    return (
                      <AnimatedPressable
                        key={item.id}
                        style={styles.card}
                        onPress={() => onPressItem(item)}
                        pressScale={1}
                        hoverEffect
                        accessibilityRole="button"
                        accessibilityLabel={item.title}
                      >
                        <View style={styles.cardInner}>
                          <View style={styles.cardTile}>
                            {TileIcon ? (
                              <TileIcon size={28} color={tileColor} strokeWidth={1.75} />
                            ) : (
                              <OymoOrnament size={24} color={tileColor} strokeWidth={1.5} />
                            )}
                            <View style={[styles.cardTileAccent, { backgroundColor: tileColor }]} />
                          </View>
                          <View style={styles.cardBody}>
                            <Text style={styles.cardTitle} numberOfLines={2}>
                              {item.title}
                            </Text>
                            {item.type_label ? (
                              <Text style={styles.cardType} numberOfLines={1}>
                                {t(`culture.item.type.${item.type_label}`)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stateBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.xs,
  },
  groupTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    flexGrow: 0,
    flexBasis: '47%',
    borderRadius: radii.lg,
    ...shadows.card,
  },
  cardInner: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardTile: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTileAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  cardBody: {
    padding: spacing.xs,
    gap: 2,
    minHeight: 58,
  },
  cardType: {
    ...typography.small,
    color: colors.textMuted,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 18,
  },
});
