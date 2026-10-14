import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { useShareCard } from '@/services/share/useShareCard';
import { cardRadii, cards, colors, controlStates, headings, layout, spacing, text } from '@/theme';

import { CANVAS_SIZE } from '../components/OymoCanvas';
import { describeDesign } from '../remix/remixModel';
import { SurfacedArtwork } from './SurfaceTexture';
import { affectsPerceivedColor, exportSurface, previewSource, SURFACES, type SurfaceId } from './surfacesModel';

/**
 * /culture/oymo/preview - see the CURRENT design as a mockup on paper, on
 * fabric or plain, and choose whether the surface goes into the exported
 * image. Works on a copy: the saved design and its recipe are untouched.
 */
export function SurfacePreviewScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const owner = useRecordsOwner();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const design = useMemo(() => previewSource(owner), [owner]);
  const [surface, setSurface] = useState<SurfaceId>('paper');
  const [includeSurface, setIncludeSurface] = useState(true);
  const { share, shareHost, isSharing } = useShareCard();
  const size = Math.min(width - layout.gutter * 2, 360);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('surfaces.title')}
      </Text>
    </View>
  );
  if (!design || design.layers.length === 0) {
    return (
      <View style={styles.root}>
        {header}
        <View style={[styles.content, styles.empty]} testID="surface-preview-none">
          <Text style={styles.body}>{t('surfaces.noDesign')}</Text>
          <Button label={t('surfaces.backToCreator')} onPress={onPressBack} />
        </View>
      </View>
    );
  }

  const surfaceName = t(`surfaces.names.${surface}`);
  const facts = describeDesign(design);
  const description = t('surfaces.description', { surface: surfaceName, count: facts.shownMotifs });
  const exported = exportSurface(surface, includeSurface);

  function handleExport() {
    if (!design) return;
    // Only the design and the lab's own label - no name, account, recipe or notes.
    void share(
      {
        variant: 'creation',
        title: t('culture.labs.myDesign'),
        label: t('culture.interactive.oymo'),
        imageSource: null,
        artwork: <SurfacedArtwork layers={design.layers} backgroundColor={design.backgroundColor} symmetryMode={design.symmetry} surface={exported} size={CANVAS_SIZE} />,
        artworkSize: { width: CANVAS_SIZE, height: CANVAS_SIZE },
      },
      t('culture.labs.shareMessage'),
    );
  }

  return (
    <View style={styles.root} testID="surface-preview">
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.note}>{t('surfaces.mockupNote')}</Text>
        <Animated.View key={surface} entering={reducedMotion ? undefined : FadeIn.duration(160)} style={styles.stage} accessible accessibilityRole="image" accessibilityLabel={description} testID={`surface-stage-${surface}`}>
          <SurfacedArtwork layers={design.layers} backgroundColor={design.backgroundColor} symmetryMode={design.symmetry} surface={surface} size={size} />
        </Animated.View>

        <Text style={styles.section} accessibilityRole="header">
          {t('surfaces.choose')}
        </Text>
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={t('surfaces.choose')}>
          {SURFACES.map((id) => (
            <AnimatedPressable
              key={id}
              style={[styles.option, surface === id && styles.optionOn]}
              onPress={() => setSurface(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: surface === id }}
              aria-checked={surface === id}
              accessibilityLabel={t(`surfaces.names.${id}`)}
              testID={`surface-${id}`}
            >
              <Text style={[styles.optionText, surface === id && styles.optionTextOn]}>{t(`surfaces.names.${id}`)}</Text>
            </AnimatedPressable>
          ))}
        </View>
        {affectsPerceivedColor(surface) ? (
          <Text style={styles.colorNote} testID="surface-color-note">
            {t(`surfaces.colorNote.${surface}`)}
          </Text>
        ) : (
          <Text style={styles.meta}>{t('surfaces.plainNote')}</Text>
        )}

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchLabel}>{t('surfaces.include')}</Text>
            <Text style={styles.meta}>{includeSurface && surface !== 'plain' ? t('surfaces.includeOn', { surface: surfaceName }) : t('surfaces.includeOff')}</Text>
          </View>
          <Switch value={includeSurface} onValueChange={setIncludeSurface} disabled={surface === 'plain'} accessibilityLabel={t('surfaces.include')} testID="surface-include" />
        </View>
        <Button label={t('surfaces.export')} onPress={handleExport} loading={isSharing} accessibilityHint={t('surfaces.exportHint')} testID="surface-export" />
        <Text style={styles.meta}>{t('surfaces.privacy')}</Text>
      </ScrollView>
      {shareHost}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.gutter, paddingBottom: spacing.sm },
  title: { ...headings.screen, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: layout.gutter, gap: layout.stackGap, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  empty: { paddingTop: spacing.lg },
  body: { ...text.body, color: colors.textPrimary },
  note: { ...cards.note, ...text.meta, color: colors.textPrimary },
  stage: { alignSelf: 'center', borderRadius: cardRadii.media, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle },
  section: { ...headings.label, color: colors.textSecondary, marginTop: spacing.xs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: cardRadii.chip, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  optionOn: { backgroundColor: controlStates.selected.bg, borderColor: controlStates.selected.border },
  optionText: { ...text.emphasis, color: colors.textPrimary },
  optionTextOn: { color: controlStates.selected.fg, fontWeight: '700' },
  colorNote: { ...text.meta, color: colors.textPrimary, paddingLeft: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.accentGold },
  meta: { ...text.meta, color: colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1 },
  switchLabel: { ...text.emphasis, fontWeight: '700', color: colors.textPrimary },
});
