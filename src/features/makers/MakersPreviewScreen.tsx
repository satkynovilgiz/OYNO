import { ChevronLeft } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { FIXTURE_LABEL, FIXTURE_MAKERS, MAKERS, MAKERS_PUBLIC_ENABLED, resolveMedia, validateMaker } from './makersModel';

/**
 * /admin/makers - INTERNAL preview of the Meet the Makers schema with the
 * labelled demo fixture (admin-only, English like the other admin tools).
 * Shows what validation and media fallback do; it is not the public feature.
 */
export function MakersPreviewScreen({ onPressBack }: { onPressBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel="Back" onPress={onPressBack} />
        <Text style={styles.title} accessibilityRole="header">
          Meet the Makers (internal)
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.banner} testID="makers-fixture-banner">
          {FIXTURE_LABEL}. Public entry: {MAKERS_PUBLIC_ENABLED ? 'ON' : 'OFF'}. Real profiles: {MAKERS.length}. See docs/MEET_THE_MAKERS.md for the contributor checklist.
        </Text>
        {FIXTURE_MAKERS.map((maker) => (
          <View key={maker.id} style={styles.card} testID={`makers-fixture-${maker.id}`}>
            <Text style={styles.heading}>{maker.name}</Text>
            <Text style={styles.body}>{maker.bio.en ?? maker.bio.kg}</Text>
            {maker.media.map((media, index) => {
              const resolved = resolveMedia(media, maker.consent, 'en');
              return (
                <View key={index} style={styles.placeholder}>
                  <Text style={styles.meta}>{resolved.kind === 'placeholder' ? `${resolved.of}: placeholder (${resolved.reason.replace('_', ' ')})` : `${resolved.kind}: ${resolved.description} - ${resolved.credit}, ${resolved.license}`}</Text>
                </View>
              );
            })}
            <Text style={styles.section}>Why this can't be public</Text>
            {validateMaker(maker).map((error) => (
              <Text key={error} style={styles.meta}>
                - {error}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  heading: { ...typography.h2, color: colors.textPrimary },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  banner: { ...textStyles.small, fontWeight: '700', color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted, borderLeftWidth: 4, borderLeftColor: colors.accentTerracottaText },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  placeholder: { padding: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderSubtle },
});
