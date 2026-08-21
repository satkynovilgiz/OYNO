import Constants from 'expo-constants';
import { FileText, Scale, ScrollText } from 'lucide-react-native';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import wordmark from '@assets/img/OYNO_design/wordmark.png';

import { SettingsRow } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type AboutScreenProps = {
  onPressBack: () => void;
};

/** Privacy Policy / Terms / Licenses have no real, legally-reviewed text
 * yet - showing an honest "not available yet" notice here rather than
 * fabricating legal documents (same principle as the cultural-accuracy
 * "don't invent" rule, applied to legal content). */
function showUnavailable(title: string) {
  Alert.alert(title, 'Бул документ азырынча даяр эмес.');
}

export function AboutScreen({ onPressBack }: AboutScreenProps) {
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <SettingsScreenLayout title="OYNO жөнүндө" onPressBack={onPressBack}>
      <View style={styles.hero}>
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.version}>Версия {version}</Text>
      </View>

      <Text style={styles.mission}>
        Кыргыз маданиятын заманбап санариптик дүйнөгө алып келүү.
      </Text>

      <View style={styles.group}>
        <SettingsRow icon={FileText} label="Купуялык саясаты" onPress={() => showUnavailable('Купуялык саясаты')} />
        <SettingsRow icon={ScrollText} label="Колдонуу шарттары" onPress={() => showUnavailable('Колдонуу шарттары')} />
        <SettingsRow icon={Scale} label="Лицензиялар" onPress={() => showUnavailable('Лицензиялар')} />
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  wordmark: {
    width: 180,
    height: 48,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
  },
  mission: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  group: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
