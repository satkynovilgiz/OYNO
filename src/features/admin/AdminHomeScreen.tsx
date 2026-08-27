import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { useAdminRole } from '@/services/admin/adminService';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { ADMIN_SECTIONS } from './sections';

type AdminHomeScreenProps = {
  onPressBack: () => void;
  onPressSection: (sectionId: string) => void;
  onPressPush: () => void;
};

/** Internal tooling, not part of the app's localized surface - kept in
 * English deliberately (same reasoning as the rest of this file: it's for
 * whoever has an admin_roles row, not end users) rather than adding a
 * fourth i18n surface nobody but an admin will ever see. */
export function AdminHomeScreen({ onPressBack, onPressSection, onPressPush }: AdminHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { data: role, isLoading } = useAdminRole();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title}>Admin panel</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !role ? (
        <View style={styles.center}>
          <Text style={styles.notAuthorized}>You don't have admin access on this account.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.roleLabel}>Signed in as: {role}</Text>

          <AnimatedPressable style={styles.row} onPress={onPressPush} accessibilityRole="button" accessibilityLabel="Push broadcast">
            <Text style={styles.rowLabel}>Push notifications (broadcast)</Text>
            <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
          </AnimatedPressable>

          {ADMIN_SECTIONS.map((section) => (
            <AnimatedPressable
              key={section.id}
              style={styles.row}
              onPress={() => onPressSection(section.id)}
              accessibilityRole="button"
              accessibilityLabel={section.label}
            >
              <Text style={styles.rowLabel}>{section.label}</Text>
              <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
            </AnimatedPressable>
          ))}

          <Text style={styles.footnote}>
            Achievements and game catalog entries aren't editable here yet - achievements are
            code-defined conditions (src/services/progress/achievements.ts), and games aren't
            backed by a database table. Both would need their own schema/engine work first.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  notAuthorized: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  roleLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  rowLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  footnote: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
