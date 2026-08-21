import { ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnimatedPressable, Button, TextField } from '@/components/ui';
import { colors, radii, shadows, spacing, typography } from '@/theme';

import { SettingsScreenLayout } from './components/SettingsScreenLayout';
import { FAQ_CATEGORY_LABELS, faqItems, type FaqCategory } from './faqData';

const SUPPORT_EMAIL = 'support@oyno.app'; // placeholder inbox - swap for a real one when it exists

type HelpScreenProps = {
  onPressBack: () => void;
};

export function HelpScreen({ onPressBack }: HelpScreenProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FaqCategory | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const filteredFaq = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return faqItems.filter((item) => {
      const matchesCategory = !activeCategory || item.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        item.question.toLowerCase().includes(normalizedQuery) ||
        item.answer.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  const handleSendMessage = () => {
    const mailSubject = encodeURIComponent(subject || 'OYNO колдоо');
    const mailBody = encodeURIComponent(message);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${mailSubject}&body=${mailBody}`);
  };

  return (
    <SettingsScreenLayout title="Жардам" onPressBack={onPressBack}>
      <View style={styles.searchRow}>
        <Search size={16} color={colors.textMuted} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Суроо издеңиз..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Суроо издөө"
        />
      </View>

      <View style={styles.chipsRow}>
        <CategoryChip label="Баары" isActive={!activeCategory} onPress={() => setActiveCategory(null)} />
        {(Object.keys(FAQ_CATEGORY_LABELS) as FaqCategory[]).map((category) => (
          <CategoryChip
            key={category}
            label={FAQ_CATEGORY_LABELS[category]}
            isActive={activeCategory === category}
            onPress={() => setActiveCategory(category)}
          />
        ))}
      </View>

      {filteredFaq.length === 0 ? (
        <Text style={styles.emptyText}>Эч нерсе табылган жок.</Text>
      ) : (
        <View style={styles.faqList}>
          {filteredFaq.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <AnimatedPressable
                key={item.id}
                style={styles.faqItem}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.question}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  {isExpanded ? (
                    <ChevronUp size={16} color={colors.textMuted} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={16} color={colors.textMuted} strokeWidth={2} />
                  )}
                </View>
                {isExpanded ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
              </AnimatedPressable>
            );
          })}
        </View>
      )}

      <View style={styles.contactForm}>
        <Text style={styles.contactTitle}>Биз менен байланышуу</Text>
        <TextField label="Тема" value={subject} onChangeText={setSubject} placeholder="Суроонун темасы" />
        <TextField label="Билдирүү" value={message} onChangeText={setMessage} placeholder="Билдирүүңүздү жазыңыз..." />
        <Button label="Жөнөтүү" onPress={handleSendMessage} disabled={!message.trim()} />
      </View>
    </SettingsScreenLayout>
  );
}

function CategoryChip({ label, isActive, onPress }: { label: string; isActive: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      style={[styles.chip, isActive && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipLabel: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: colors.textOnPrimary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  faqList: {
    gap: spacing.xs,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqQuestion: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  faqAnswer: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  contactForm: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  contactTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
});
