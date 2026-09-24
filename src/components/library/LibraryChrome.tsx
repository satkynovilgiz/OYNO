import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, IconButton } from '@/components/ui';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

/** "Your OYNO" screen header: back, a small eyebrow, a large title and one
 * line of context - shared by Search, Saved and Offline Downloads. */
export function LibraryHeader({ title, subtitle, onPressBack, children }: { title?: string; subtitle?: string; onPressBack: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerRow}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        {title ? (
          <View style={styles.headerText}>
            <View style={styles.eyebrowRow}>
              <OymoOrnament size={10} color={colors.accentGoldPressed} strokeWidth={1.75} />
              <Text style={styles.eyebrow}>{t('library.eyebrow')}</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
          </View>
        ) : (
          <View style={styles.headerText}>{children}</View>
        )}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {title ? children : null}
    </View>
  );
}

/** Editorial section header: title, optional count, optional action. */
export function LibrarySectionHeader({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {count !== undefined ? <Text style={styles.sectionCount}>{count}</Text> : null}
      <View style={styles.flex} />
      {action}
    </View>
  );
}

/** Horizontal filter chips that never squash long labels. */
export function LibraryFilterChips<T extends string>({ options, value, label, onChange }: { options: T[]; value: T; label: (option: T) => string; onChange: (option: T) => void }) {
  return (
    // Bleeds to the screen edges (the header is padded) so the last chip
    // scrolls fully into view instead of being cut by the padding.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBleed} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option === value;
        return (
          <AnimatedPressable
            key={option}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option)}
            haptic="light"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label(option)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label(option)}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

/** Distinct, designed empty states (search / saved / downloads) - an icon
 * medallion, a title, one line, and optional real next steps. */
export function LibraryEmptyState({ icon: Icon, tone, title, description, children }: { icon: LucideIcon; tone: string; title: string; description: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.medallion, { borderColor: tone }]}>
        <OymoOrnament size={78} color="rgba(199,154,46,0.22)" strokeWidth={1.1} />
        <Icon size={28} color={tone} strokeWidth={1.75} style={styles.medallionIcon} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...typography.overline, color: colors.accentGoldPressed },
  title: { fontFamily: fontFamily.wordmark, fontSize: 28, lineHeight: 33, fontWeight: '700', color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.xs },
  sectionTitle: { ...typography.h2, color: colors.textPrimary },
  sectionCount: { ...typography.caption, fontWeight: '700', color: colors.accentTerracotta },
  flex: { flex: 1 },
  chipsBleed: { marginHorizontal: -spacing.md },
  chips: { gap: spacing.xs, paddingHorizontal: spacing.md },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, flexShrink: 0 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  chipTextSelected: { color: colors.textOnDark },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md, gap: spacing.xs },
  medallion: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginBottom: spacing.xs },
  medallionIcon: { position: 'absolute' },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  emptyDescription: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
});
