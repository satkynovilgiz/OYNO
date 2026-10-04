import { router } from 'expo-router';
import { BookOpen, X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, MediaImage } from '@/components/ui';
import { cultureItemImages } from '@/features/culture/data';
import type { SupportedLanguage } from '@/i18n';
import { track } from '@/services/analytics/analytics';
import { localizedSimpleSummary } from '@/services/audioGuide/contentNarration';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing, textStyles } from '@/theme';

import { glossaryRoute } from '../glossaryData';
import type { ResolvedGlossaryEntry } from '../glossaryModel';
import { useGlossary } from '../useGlossary';
import { buildInlineTermIndex, EMPTY_TERM_INDEX, inlineDefinition, segmentText, selfEntryIds, type InlineTermIndex } from './inlineTermIndex';

type InlineGlossaryValue = {
  /** Term index per rendered article language (built lazily, once each). */
  indexFor: (language: SupportedLanguage) => InlineTermIndex;
  exclude: ReadonlySet<string>;
  open: (entryId: string) => void;
};

const InlineGlossaryContext = createContext<InlineGlossaryValue | null>(null);

/**
 * Wraps one article. Provides the prebuilt term index and the quick-lookup
 * sheet; GlossaryText inside renders a section with its terms tappable.
 * `articleItemId` = the culture_item being read (its own terms are not
 * linked back to itself); null for materials.
 */
export function InlineGlossaryProvider({ articleItemId, children }: { articleItemId: string | null; children: ReactNode }) {
  const { entries } = useGlossary();
  const [openId, setOpenId] = useState<string | null>(null);
  const cache = useMemo(() => new Map<SupportedLanguage, InlineTermIndex>(), [entries]);
  const indexFor = useCallback(
    (language: SupportedLanguage) => {
      let index = cache.get(language);
      if (!index) {
        index = entries.length ? buildInlineTermIndex(entries, language) : EMPTY_TERM_INDEX;
        cache.set(language, index);
      }
      return index;
    },
    [cache, entries],
  );
  const exclude = useMemo(() => selfEntryIds(entries, articleItemId), [entries, articleItemId]);
  const open = useCallback((entryId: string) => {
    setOpenId(entryId);
    // Only the entry id - never the surrounding article text.
    track('inline_glossary_opened', { glossary_entry_id: entryId });
  }, []);
  const value = useMemo(() => ({ indexFor, exclude, open }), [indexFor, exclude, open]);
  const opened = openId ? (entries.find(({ entry }) => entry.id === openId) ?? null) : null;
  return (
    <InlineGlossaryContext.Provider value={value}>
      {children}
      {opened ? <InlineGlossarySheet resolved={opened} onClose={() => setOpenId(null)} /> : null}
    </InlineGlossaryContext.Provider>
  );
}

/**
 * One section's text with known glossary terms (first occurrence in this
 * section, authored forms in `language` only) as subtle dotted-underlined,
 * tappable spans. Same Text node and style as before, so Reader Mode text
 * size / line spacing apply to terms too. Without a provider, or with no
 * match, it is exactly a plain <Text>.
 */
export function GlossaryText({ text, language, style }: { text: string; language: SupportedLanguage; style: StyleProp<TextStyle> }) {
  const { t } = useTranslation();
  const glossary = useContext(InlineGlossaryContext);
  const segments = useMemo(() => (glossary ? segmentText(text, glossary.indexFor(language), { exclude: glossary.exclude }) : null), [glossary, text, language]);
  if (!glossary || !segments || segments.every((segment) => segment.kind === 'text')) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {segments.map((segment, position) =>
        segment.kind === 'text' ? (
          segment.text
        ) : (
          <Text
            key={position}
            style={styles.term}
            onPress={() => glossary.open(segment.entryId)}
            suppressHighlighting={false}
            accessibilityRole="link"
            accessibilityLabel={`${segment.text}, ${t('glossary.inlineTermA11y')}`}
            accessibilityHint={t('glossary.inlineTermHint')}
          >
            {segment.text}
          </Text>
        ),
      )}
    </Text>
  );
}

/** Quick lookup: term, short existing definition, [Open Glossary]. */
function InlineGlossarySheet({ resolved, onClose }: { resolved: ResolvedGlossaryEntry; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { experience } = useAgeExperience();
  const definition = inlineDefinition(resolved, experience, localizedSimpleSummary(resolved.item, i18n.language as SupportedLanguage));
  const image = definition.showImage ? (cultureItemImages[resolved.item.id]?.[0] ?? null) : null;
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, definition.large && styles.sheetLarge, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.overline}>{t('glossary.termA11y')}</Text>
            <Text style={[styles.title, definition.large && styles.titleLarge]} accessibilityRole="header">
              {definition.term}
            </Text>
          </View>
          <IconButton icon={X} size={40} iconSize={18} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>
        {image ? (
          <View style={[styles.image, definition.large && styles.imageLarge]}>
            <MediaImage source={image} />
          </View>
        ) : null}
        <Text style={[styles.definition, definition.large && styles.definitionLarge]}>{definition.text}</Text>
        <Text style={styles.from}>{t('glossary.from', { title: resolved.item.title })}</Text>
        <Button
          label={t('glossary.openGlossary')}
          icon={<BookOpen size={18} color={colors.textOnPrimary} strokeWidth={2.25} />}
          onPress={() => {
            onClose();
            router.push(glossaryRoute(resolved.entry.id) as never);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Glossary semantics: dotted underline in the text's own colour - distinct
  // from Read & Listen (section background) and saved passages (bookmark row).
  term: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.accentTerracotta },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { gap: spacing.sm, padding: spacing.md, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  sheetLarge: { gap: spacing.md, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  overline: { ...textStyles.overline, color: colors.accentTerracotta },
  title: { ...textStyles.title, fontSize: 22, color: colors.textPrimary },
  titleLarge: { fontSize: 28 },
  image: { width: '100%', aspectRatio: 2.2, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  imageLarge: { aspectRatio: 1.6 },
  definition: { ...textStyles.body, color: colors.textPrimary },
  definitionLarge: { fontSize: 19, lineHeight: 28 },
  from: { ...textStyles.small, color: colors.textSecondary },
});
