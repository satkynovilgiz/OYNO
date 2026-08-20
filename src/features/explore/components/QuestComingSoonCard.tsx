import { Target } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconChip } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

/** Honest placeholder: the quest system (spec Section 11) isn't built yet. */
export function QuestComingSoonCard() {
  return (
    <Card style={styles.card}>
      <IconChip icon={Target} size={44} iconSize={22} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>Квесттер</Text>
        <Text style={styles.subtitle}>Жакында кошулат...</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
