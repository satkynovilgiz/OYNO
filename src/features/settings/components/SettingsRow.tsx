import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Toggle } from '@/components/ui';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

type SettingsRowProps = {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  /** Current value shown on the right ("Русский", "14–17", "Off"). */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  /** Renders a toggle instead of a chevron; the whole row flips it. */
  toggle?: { value: boolean; onChange: (value: boolean) => void };
};

/**
 * One settings row (52-64 pt; a little larger for children): icon, title,
 * optional subtitle, current value, then a chevron or a toggle. The whole
 * row is the touch target, and screen readers hear title, value and state.
 * Rows sit inside a SettingsSection (one rounded surface, hairline
 * separators) - never as separate floating cards.
 */
export function SettingsRow({ icon: Icon, label, subtitle, value, onPress, destructive = false, showChevron = true, toggle }: SettingsRowProps) {
  const { experience } = useAgeExperience();
  const large = experience === 'child';
  const a11yLabel = [label, value, subtitle].filter(Boolean).join(', ');
  const press = toggle ? () => toggle.onChange(!toggle.value) : onPress;

  return (
    <AnimatedPressable
      style={[styles.row, large && styles.rowLarge]}
      onPress={press}
      press="soft"
      disabled={!press}
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityState={toggle ? { checked: toggle.value } : undefined}
      accessibilityLabel={a11yLabel}
    >
      <View style={[styles.icon, destructive && styles.iconDestructive]}>
        <Icon size={18} color={destructive ? colors.error : colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.label, destructive && styles.labelDestructive, large && styles.labelLarge]} numberOfLines={2}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Toggle value={toggle.value} onValueChange={toggle.onChange} accessibilityLabel={label} />
        </View>
      ) : showChevron ? (
        <ChevronRight size={17} color={colors.textMuted} strokeWidth={2} />
      ) : null}
    </AnimatedPressable>
  );
}

/**
 * A titled group of rows on one rounded surface with hairline separators.
 * Children are rows; separators are inserted between them.
 */
export function SettingsSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  sectionTitle: { ...textStyles.overline, color: colors.textSecondary, marginHorizontal: spacing.xxs },
  group: { borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.borderSubtle, marginLeft: spacing.md + 34 + spacing.sm },
  footer: { ...textStyles.caption, color: colors.textMuted, marginHorizontal: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  rowLarge: { minHeight: 64 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  iconDestructive: { backgroundColor: 'rgba(214,69,69,0.1)' },
  text: { flex: 1, gap: 1, minWidth: 0 },
  label: { ...textStyles.bodyMedium, color: colors.textPrimary },
  labelLarge: { fontSize: 17, lineHeight: 23 },
  labelDestructive: { color: colors.error },
  subtitle: { ...textStyles.caption, color: colors.textMuted },
  value: { ...textStyles.caption, fontWeight: '600', color: colors.textSecondary, maxWidth: '38%' },
});
