import { ChevronDown, ChevronUp, Lock } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button, IconButton } from '@/components/ui';
import { isCustomized, moveSection, orderedSections, REQUIRED_SECTIONS, setShown } from '@/features/home/homeLayout';
import type { HomeSectionId } from '@/features/home/homeSections';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useHomeLayoutStore } from '@/store/useHomeLayoutStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

/**
 * /settings/home - Customize Home: show/hide and move the OPTIONAL Home
 * sections of the current age experience. A compact list, not a second Home.
 * Changes apply at once; Reset returns to the age's recommended layout.
 */
export function CustomizeHomeScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const { experience } = useAgeExperience();
  const prefs = useHomeLayoutStore((state) => state.prefs);

  useEffect(() => {
    void useHomeLayoutStore.getState().load();
  }, []);

  const order = orderedSections(experience, prefs);
  const optional = order.filter((id) => !REQUIRED_SECTIONS.includes(id));
  const name = (id: HomeSectionId) => t(`customizeHome.sections.${id}`);
  const update = (next: typeof prefs) => useHomeLayoutStore.getState().set(next);

  return (
    <SettingsScreenLayout title={t('customizeHome.title')} onPressBack={onPressBack}>
      <View style={styles.stack}>
        <Text style={styles.intro}>{t('customizeHome.intro')}</Text>
        <Text style={styles.section} accessibilityRole="header">
          {t('customizeHome.sectionsTitle')}
        </Text>
        <View style={styles.card}>
          {order.map((id, index) => {
            const required = REQUIRED_SECTIONS.includes(id);
            const shown = required || !prefs.hidden.includes(id);
            const position = optional.indexOf(id);
            return (
              <View key={id} style={[styles.row, index > 0 && styles.divider]}>
                <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${name(id)}, ${required ? t('customizeHome.required') : shown ? t('customizeHome.shown') : t('customizeHome.hidden')}`}>
                  <Text style={[styles.rowTitle, !shown && styles.rowHidden]}>{name(id)}</Text>
                  <Text style={styles.meta}>{required ? t('customizeHome.required') : shown ? t('customizeHome.shown') : t('customizeHome.hidden')}</Text>
                </View>
                {required ? (
                  <Lock size={16} color={colors.textMuted} strokeWidth={2} />
                ) : (
                  <>
                    <IconButton icon={ChevronUp} size={36} iconSize={16} elevated={false} disabled={position === 0} accessibilityLabel={t('customizeHome.moveUp', { name: name(id) })} onPress={() => update(moveSection(prefs, experience, id, -1))} />
                    <IconButton icon={ChevronDown} size={36} iconSize={16} elevated={false} disabled={position === optional.length - 1} accessibilityLabel={t('customizeHome.moveDown', { name: name(id) })} onPress={() => update(moveSection(prefs, experience, id, 1))} />
                    <Switch value={shown} onValueChange={(value) => update(setShown(prefs, id, value))} accessibilityLabel={`${name(id)}, ${shown ? t('customizeHome.shown') : t('customizeHome.hidden')}`} />
                  </>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.meta}>{t('customizeHome.immediate')}</Text>
        <Text style={styles.meta}>{t('customizeHome.emptyNote')}</Text>
        <Button label={t('customizeHome.reset')} variant="secondary" disabled={!isCustomized(prefs, experience)} onPress={() => useHomeLayoutStore.getState().reset()} />
        {!isCustomized(prefs, experience) ? <Text style={styles.meta}>{t('customizeHome.defaultLayout')}</Text> : null}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  intro: { ...textStyles.body, color: colors.textSecondary },
  section: { ...typography.overline, color: colors.accentTerracotta },
  card: { borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.borderSubtle },
  rowTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  rowHidden: { color: colors.textMuted },
  meta: { ...textStyles.small, color: colors.textSecondary },
});
