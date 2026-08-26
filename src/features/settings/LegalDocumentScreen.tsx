import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type LegalSection = {
  heading: string;
  body: string;
};

type LegalDocumentScreenProps = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  onPressBack: () => void;
};

/** Shared renderer for the Privacy Policy and Terms of Use screens - both
 * are the same shape (intro paragraph + headed sections), sourced from
 * i18n so each language ships its own real text rather than a stub. */
export function LegalDocumentScreen({ title, updated, intro, sections, onPressBack }: LegalDocumentScreenProps) {
  return (
    <SettingsScreenLayout title={title} onPressBack={onPressBack}>
      <Text style={styles.updated}>{updated}</Text>
      <Text style={styles.intro}>{intro}</Text>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  updated: {
    ...typography.caption,
    color: colors.textMuted,
  },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.xxs,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
