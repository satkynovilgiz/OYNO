import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { useNetworkStatus } from '@/services/offline/networkStatus';
import { isRouteAvailableOffline } from '@/services/offline/offlineAvailability';
import { cardRadii, colors, iconSizes, spacing, textStyles, typography } from '@/theme';

import { CREATE_GROUPS, type CreateEntry } from './createHub';

/**
 * /create - the Create destination from Home: the existing making tools
 * grouped in one place (make something, tools, your work). Every row opens
 * an EXISTING screen; nothing here is new functionality.
 */
export function CreateHubScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('create_hub');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const canOpen = (route: string) => !isOffline || isRouteAvailableOffline(route, queryClient);

  const row = (entry: CreateEntry) => {
    const available = canOpen(entry.route);
    const title = t(entry.titleKey);
    const body = t(entry.bodyKey);
    return (
      <AnimatedPressable
        key={entry.id}
        style={[styles.row, !available && styles.rowOff]}
        onPress={() => (available ? router.push(entry.route as never) : undefined)}
        press="soft"
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}${available ? '' : `. ${t('createHub.needsConnection')}`}`}
        accessibilityState={{ disabled: !available }}
        testID={`create-hub-${entry.id}`}
      >
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowBody}>{body}</Text>
          {!available ? <Text style={styles.warn}>{t('createHub.needsConnection')}</Text> : null}
        </View>
        <ChevronRight size={iconSizes.sm} color={colors.textSecondary} strokeWidth={2} />
      </AnimatedPressable>
    );
  };

  return (
    <View style={styles.root} testID="create-hub">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {t('createHub.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.intro}>{t('createHub.intro')}</Text>
        {CREATE_GROUPS.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.section} accessibilityRole="header">
              {t(`createHub.groups.${group.id}`)}
            </Text>
            {group.entries.map(row)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  intro: { ...textStyles.body, color: colors.textSecondary },
  group: { gap: spacing.xs },
  section: { ...textStyles.overline, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: cardRadii.compact,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rowOff: { opacity: 0.7 },
  flex: { flex: 1, gap: 2 },
  rowTitle: {
    ...textStyles.bodyMedium,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowBody: { ...textStyles.caption, color: colors.textSecondary },
  warn: { ...textStyles.small, color: colors.accentTerracottaText },
});
