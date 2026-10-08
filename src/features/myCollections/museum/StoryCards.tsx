import { router } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronRight, ImageOff, Landmark } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';

import type { ShareCardContent } from '@/components/share/ShareCard';
import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { announce } from '@/services/a11y/announce';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import type { Exhibition, ExhibitSlide } from './museumModel';
import { addCard, canTell, CARD_TEXT_MAX, CARD_TITLE_MAX, cardContent, EMPTY_STORY, endStoryPlace, keepStoryPlace, moveCard, removeCard, resumeStoryPlace, setCardWords, STORY_MAX, STORY_MIN, storySlides, type Story, type StoryCardContent } from './storyModel';

/** Logical size of an exported story card (captured at 3x: 1080 x 1350). */
export const STORY_CARD_SIZE = { width: 360, height: 450 };

/** Curator side: choose and order up to six exhibits that can be shown, with optional words per card. */
export function StorySetup({ exhibition, slides, titleOf, onChange, onPresent }: { exhibition: Exhibition; slides: ExhibitSlide[]; titleOf: (key: string) => string; onChange: (story: Story) => void; onPresent: () => void }) {
  const { t } = useTranslation();
  const story = exhibition.story ?? EMPTY_STORY;
  const available = new Set(slides.filter((slide) => slide.kind === 'exhibit').map((slide) => slide.key));
  const unused = exhibition.exhibits.filter((key) => !story.cards.some((card) => card.key === key));
  return (
    <View style={styles.card} testID="story-setup">
      <Text style={styles.cardTitle} accessibilityRole="header">
        {t('museum.story.sectionTitle')}
      </Text>
      <Text style={styles.meta}>{t('museum.story.sectionHint')}</Text>
      <Text style={styles.label}>{t('museum.story.pickTitle', { count: story.cards.length, max: STORY_MAX })}</Text>
      {story.cards.map((card, index) => (
        <View key={card.key} style={styles.storyCard} testID={`story-card-${index}`}>
          <View style={styles.rowBetween}>
            <Text style={styles.bodyBold}>{t('museum.story.cardLabel', { n: index + 1, part: t(`museum.story.parts.${index === 0 ? 'beginning' : index === story.cards.length - 1 ? 'ending' : 'middle'}`) })}</Text>
            <View style={styles.row}>
              <IconButton icon={ArrowUp} size={36} iconSize={14} elevated={false} disabled={index === 0} accessibilityLabel={t('museum.story.moveUp', { name: titleOf(card.key) })} onPress={() => onChange(moveCard(story, index, -1))} testID={`story-up-${index}`} />
              <IconButton icon={ArrowDown} size={36} iconSize={14} elevated={false} disabled={index === story.cards.length - 1} accessibilityLabel={t('museum.story.moveDown', { name: titleOf(card.key) })} onPress={() => onChange(moveCard(story, index, 1))} testID={`story-down-${index}`} />
            </View>
          </View>
          <Text style={styles.body}>{titleOf(card.key)}</Text>
          <TextInput value={card.title} onChangeText={(title) => onChange(setCardWords(story, card.key, { title }))} maxLength={CARD_TITLE_MAX} placeholder={t('museum.story.titleLabel')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('museum.story.titleLabel')} style={styles.input} testID={`story-title-${index}`} />
          <TextInput value={card.text} onChangeText={(text) => onChange(setCardWords(story, card.key, { text }))} maxLength={CARD_TEXT_MAX} multiline placeholder={t('museum.story.textLabel')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('museum.story.textLabel')} style={[styles.input, styles.inputTall]} testID={`story-text-${index}`} />
          <Text style={styles.counter}>{t('museum.story.limit', { count: card.text.length, max: CARD_TEXT_MAX })}</Text>
          <Button label={t('museum.story.remove')} variant="text" onPress={() => onChange(removeCard(story, card.key))} testID={`story-remove-${index}`} />
        </View>
      ))}
      {story.cards.length < STORY_MAX && unused.length > 0 ? <Text style={styles.label}>{t('museum.story.addTitle')}</Text> : null}
      {story.cards.length < STORY_MAX
        ? unused.map((key) => {
            const canShow = available.has(key);
            return (
              <AnimatedPressable key={key} style={[styles.choice, !canShow && styles.choiceDisabled]} disabled={!canShow} onPress={() => onChange(addCard(story, key, canShow))} accessibilityRole="button" accessibilityState={{ disabled: !canShow }} accessibilityLabel={canShow ? titleOf(key) : `${titleOf(key)}, ${t('museum.story.unavailable')}`} testID={`story-add-${key}`}>
                <Text style={[styles.body, styles.flex]} numberOfLines={2}>
                  + {titleOf(key)}
                  {canShow ? '' : ` · ${t('museum.story.unavailable')}`}
                </Text>
              </AnimatedPressable>
            );
          })
        : null}
      {canTell(story) ? <Button label={t('museum.story.present')} onPress={onPresent} testID="story-present" /> : <Text style={styles.meta}>{t('museum.story.needMore', { min: STORY_MIN })}</Text>}
    </View>
  );
}

/**
 * The exported (and previewed) card: the part, the curator's title and
 * words, and the exhibit's OYNO title and picture. These are its only
 * inputs, so nothing private can appear.
 */
export function StoryCardView({ content }: { content: StoryCardContent }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.exportCard, STORY_CARD_SIZE]} testID="story-export-card">
      <Text style={styles.exportPart}>{t(`museum.story.parts.${content.part}`)}</Text>
      {content.picture ? <Image source={content.picture as ImageSourcePropType} style={styles.exportImage} resizeMode="cover" /> : <View style={[styles.exportImage, styles.noImage]}><Landmark size={28} color={colors.textMuted} /></View>}
      {content.exhibitTitle ? <Text style={styles.exportExhibit}>{content.exhibitTitle}</Text> : null}
      {content.cardTitle ? <Text style={styles.exportTitle}>{content.cardTitle}</Text> : null}
      {content.text ? <Text style={styles.exportText}>{content.text}</Text> : null}
    </View>
  );
}

/**
 * Visitor presentation: manual Next/Previous (or the whole story as a
 * list), the curator's words labelled as theirs, OYNO's information apart,
 * removed exhibits shown as such. The place in the story survives opening
 * a source (memory only).
 */
export function StoryPresent({ exhibition, slides, owner, collectionId, storyTitle, large, onShare, onEnd }: { exhibition: Exhibition; slides: ExhibitSlide[]; owner: string; collectionId: string; storyTitle: string; large: boolean; onShare: (content: ShareCardContent, fallback: string) => void; onEnd: () => void }) {
  const { t } = useTranslation();
  const story = exhibition.story ?? EMPTY_STORY;
  const cards = storySlides(story, slides);
  const resumed = resumeStoryPlace(owner, collectionId);
  const [index, setIndexState] = useState(Math.min(resumed?.index ?? 0, Math.max(0, cards.length - 1)));
  const [asList, setAsListState] = useState(resumed?.asList ?? false);
  const place = (nextIndex: number, nextList: boolean) => {
    keepStoryPlace(owner, collectionId, nextIndex, nextList);
    setIndexState(nextIndex);
    setAsListState(nextList);
  };
  const go = (next: number) => {
    place(next, asList);
    announce(t('museum.story.cardOf', { current: next + 1, total: cards.length }));
  };
  const end = () => {
    endStoryPlace();
    onEnd();
  };
  const exportCard = (position: number) => {
    const content = cardContent(cards[position]);
    onShare(
      { variant: 'postcard', title: content.cardTitle || content.exhibitTitle || t('museum.story.label'), label: t('museum.story.label'), imageSource: null, cardSize: STORY_CARD_SIZE, artwork: <StoryCardView content={content} /> },
      [content.cardTitle, content.text].filter(Boolean).join(' - ') || content.exhibitTitle || t('museum.story.label'),
    );
  };

  const renderCard = (position: number) => {
    const slide = cards[position];
    const shown = slide.exhibit?.kind === 'exhibit' ? slide.exhibit.content : null;
    return (
      <View key={slide.card.key} style={styles.stack} testID={`story-slide-${position}`}>
        <Text style={styles.label}>{t(`museum.story.parts.${slide.part}`)}</Text>
        {shown ? (
          <>
            {shown.thumbnail ? <Image source={shown.thumbnail as ImageSourcePropType} style={styles.artwork} resizeMode="cover" accessibilityLabel={shown.title} /> : <View style={[styles.artwork, styles.noImage]}><ImageOff size={22} color={colors.textMuted} /></View>}
            <View style={styles.oyno}>
              <Text style={styles.label}>{t('museum.fromOyno')}</Text>
              <Text style={[styles.heading, large && styles.headingLarge]} testID={`story-exhibit-${position}`}>
                {shown.title}
              </Text>
              {shown.route ? (
                <AnimatedPressable style={styles.link} onPress={() => router.push(shown.route as never)} accessibilityRole="link" accessibilityLabel={t('museum.openSource', { name: shown.title })} testID={`story-source-${position}`}>
                  <Text style={styles.linkText}>{t('museum.openSource', { name: shown.title })}</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </AnimatedPressable>
              ) : null}
            </View>
          </>
        ) : (
          <View style={[styles.artwork, styles.noImage]} testID={`story-removed-${position}`}>
            <Landmark size={22} color={colors.textMuted} />
            <Text style={styles.body}>{t('museum.story.removedCard')}</Text>
          </View>
        )}
        {slide.card.title.trim() || slide.card.text.trim() ? (
          <View style={styles.curator} testID={`story-words-${position}`}>
            <Text style={styles.label}>{t('museum.story.curatorWords')}</Text>
            {slide.card.title.trim() ? <Text style={[styles.bodyBold, large && styles.bodyLarge]}>{slide.card.title}</Text> : null}
            {slide.card.text.trim() ? <Text style={[styles.body, large && styles.bodyLarge]}>{slide.card.text}</Text> : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.stack} testID="story-present-view">
      <View style={styles.rowBetween}>
        <Text style={styles.meta} testID="story-progress">
          {asList ? storyTitle : t('museum.story.cardOf', { current: index + 1, total: cards.length })}
        </Text>
        <Button label={asList ? t('museum.story.asCards') : t('museum.story.asList')} variant="text" onPress={() => place(index, !asList)} testID="story-toggle-list" />
      </View>
      {asList ? cards.map((_, position) => renderCard(position)) : renderCard(index)}
      {!asList ? (
        <>
          <View style={styles.row}>
            <Button label={t('museum.story.previous')} variant="secondary" disabled={index === 0} onPress={() => go(index - 1)} testID="story-previous" />
            {index < cards.length - 1 ? <Button label={t('museum.story.next')} onPress={() => go(index + 1)} testID="story-next" /> : <Button label={t('museum.story.endStory')} onPress={end} testID="story-end" />}
          </View>
          <Button label={t('museum.story.exportCard')} variant="secondary" onPress={() => exportCard(index)} testID="story-export" />
          <Text style={styles.meta}>{t('museum.story.exportNote')}</Text>
          {Platform.OS === 'web' ? <Text style={styles.meta}>{t('museum.story.webNote')}</Text> : null}
        </>
      ) : (
        <Button label={t('museum.story.endStory')} variant="secondary" onPress={end} testID="story-end" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle, marginTop: spacing.sm },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  label: { ...textStyles.overline, color: colors.primary },
  heading: { ...typography.h2, color: colors.textPrimary },
  headingLarge: { fontSize: 26, lineHeight: 34 },
  body: { ...textStyles.body, color: colors.textPrimary },
  bodyBold: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  bodyLarge: { fontSize: 19, lineHeight: 28 },
  meta: { ...textStyles.small, color: colors.textSecondary },
  counter: { ...textStyles.small, color: colors.textSecondary, alignSelf: 'flex-end' },
  storyCard: { gap: 4, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surface },
  input: { ...textStyles.body, color: colors.textPrimary, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: cardRadii.compact, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.background },
  inputTall: { minHeight: 64, paddingVertical: spacing.xs, textAlignVertical: 'top' },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
  choiceDisabled: { borderStyle: 'dashed' },
  artwork: { width: '100%', aspectRatio: 4 / 3, borderRadius: cardRadii.media, backgroundColor: colors.surfaceMuted },
  noImage: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  oyno: { gap: 2 },
  curator: { gap: 2, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...textStyles.small, fontWeight: '700', color: colors.primary },
  exportCard: { padding: 20, gap: 8, backgroundColor: colors.surface, overflow: 'hidden' },
  exportPart: { ...textStyles.overline, color: colors.primary },
  exportImage: { width: 320, height: 220, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  exportExhibit: { ...textStyles.small, fontWeight: '700', color: colors.textSecondary },
  exportTitle: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  exportText: { fontSize: 15, lineHeight: 22, color: colors.textPrimary },
});
