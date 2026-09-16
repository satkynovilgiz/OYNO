import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, radii, spacing, typography } from '@/theme';

import { Button } from './Button';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onPressAction?: () => void;
  /** 'error' swaps the icon chip to a danger tint for load-failure states
   * (Section "Error/retry states") - everything else (no search results,
   * empty favorites/collections) uses the same neutral, friendly look. */
  tone?: 'neutral' | 'error';
  compact?: boolean;
};

/** Single shared "nothing here yet" presentation for search/filter results,
 * empty favorites/collections, and load-error states across the app
 * (Section "Use one consistent OYNO design system"). Data/search/filter
 * logic stays entirely at each call site - this only renders the message
 * and, optionally, one primary action. */
export function EmptyState({ icon: Icon, title, description, actionLabel, onPressAction, tone = 'neutral', compact = false }: EmptyStateProps) {
  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View style={[styles.iconChip, tone === 'error' && styles.iconChipError]}>
        <Icon size={26} color={tone === 'error' ? colors.danger : colors.primary} strokeWidth={1.75} />
      </View>

      <View style={styles.ornamentRow}>
        <OymoOrnament size={10} color={colors.accentGold} />
        <OymoOrnament size={12} color={colors.accentGold} />
        <OymoOrnament size={10} color={colors.accentGold} />
      </View>

      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      {actionLabel && onPressAction ? (
        <View style={styles.actionWrap}>
          <Button label={actionLabel} onPress={onPressAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  rootCompact: {
    paddingVertical: spacing.lg,
  },
  iconChip: {
    width: 56,
    height: 56,
    borderRadius: radii.xxl,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  iconChipError: {
    backgroundColor: `${colors.danger}1A`,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  actionWrap: {
    marginTop: spacing.sm,
  },
});
