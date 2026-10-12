import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useRecordsOwner } from '@/features/games/records/useGameRecords';
import { ExportCancelledError, pdfExportSupported, printAndSharePdf, SharingUnavailableError } from '@/features/journal/book/memoryBookService';
import { announce } from '@/services/a11y/announce';
import { useAuthStore } from '@/store/useAuthStore';
import { cardRadii, colors, spacing, textStyles, typography } from '@/theme';

import { OYMO_MOTIFS } from '../motifs';
import { buildStencilPage, CANVAS, DEFAULT_SETTINGS, LABEL_FIELDS, labelLines, printedDesignMm, SAFE_MARGIN, stencilFileName, stencilHtml, stencilSource, THICKNESS_MM, type LabelField, type Orientation, type StencilPage, type StencilSettings, type Thickness } from './stencilModel';

const ORIENTATIONS: Orientation[] = ['portrait', 'landscape'];
const THICKNESSES: Thickness[] = ['thin', 'medium', 'thick'];

/**
 * /culture/oymo/stencil - Stencil Studio (stencilModel.ts). An outline page
 * of the design handed over from the Creator (a copy - the design itself is
 * untouched). The preview draws the same page description the PDF prints.
 * PDF export is native-only (expo-print); elsewhere it says so.
 */
export function StencilStudioScreen({ onPressBack }: { onPressBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const owner = useRecordsOwner();
  const design = stencilSource(owner);
  const [settings, setSettings] = useState<StencilSettings>(DEFAULT_SETTINGS);
  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'failed' | 'unavailable' | 'done'>('idle');
  const supported = pdfExportSupported();
  const motifName = (id: string) => {
    const motif = OYMO_MOTIFS.find((entry) => entry.id === id);
    return motif ? t(motif.nameKey) : id;
  };
  const page = useMemo(() => (design ? buildStencilPage(design, settings, { motifName, note: t('stencil.printedNote') }) : null), [design, settings, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (change: Partial<StencilSettings>) => {
    setSettings((current) => ({ ...current, ...change }));
    if (exportState === 'done') setExportState('idle');
  };
  const toggleLabel = (field: LabelField) => update({ labels: settings.labels.includes(field) ? settings.labels.filter((entry) => entry !== field) : [...settings.labels, field] });

  const exportPdf = async () => {
    if (!page || !supported) return;
    setExportState('exporting');
    const generation = useAuthStore.getState().user?.id ?? 'guest';
    try {
      await printAndSharePdf(stencilHtml(page, settings.orientation), stencilFileName(new Date().toISOString()), { width: page.width, height: page.height }, { isValid: () => (useAuthStore.getState().user?.id ?? 'guest') === generation });
      setExportState('done');
      announce(t('stencil.exported'));
    } catch (error) {
      // Settings stay as they are; Retry runs the same export again.
      if (error instanceof ExportCancelledError) setExportState('idle');
      else {
        setExportState(error instanceof SharingUnavailableError ? 'unavailable' : 'failed');
        announce(t('stencil.exportFailed'));
      }
    }
  };

  const radio = <T extends string>(title: string, options: T[], value: T, label: (option: T) => string, onChange: (option: T) => void, id: string) => (
    <>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {options.map((option) => (
          <AnimatedPressable key={option} style={[styles.chip, value === option && styles.chipOn]} onPress={() => onChange(option)} accessibilityRole="radio" accessibilityState={{ checked: value === option }} aria-checked={value === option} testID={`stencil-${id}-${option}`}>
            <Text style={[styles.chipText, value === option && styles.chipTextOn]}>{label(option)}</Text>
          </AnimatedPressable>
        ))}
      </View>
    </>
  );
  const check = (label: string, checked: boolean, onPress: () => void, testID: string, disabled = false) => (
    <AnimatedPressable key={testID} style={[styles.check, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} aria-checked={checked} testID={testID}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={[styles.body, styles.flex]}>{label}</Text>
    </AnimatedPressable>
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ChevronLeft} shape="roundedSquare" accessibilityLabel={t('common.back')} onPress={onPressBack} />
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {t('stencil.title')}
      </Text>
    </View>
  );

  let body: React.ReactNode;
  if (!design || !page) {
    body = (
      <View style={styles.stack} testID="stencil-no-design">
        <Text style={styles.body}>{t('stencil.noDesign')}</Text>
        <Button label={t('stencil.backToCreator')} onPress={onPressBack} />
      </View>
    );
  } else {
    const previewWidth = Math.min(width - spacing.lg * 2, 420);
    body = (
      <View style={styles.stack} testID="stencil-studio">
        <Text style={styles.note} testID="stencil-not-cut-ready">
          {t('stencil.notCutReady')}
        </Text>
        <Text style={styles.body}>{t('stencil.intro')}</Text>

        <StencilPreview page={page} width={previewWidth} label={t('stencil.previewLabel', { orientation: t(`stencil.orientation.${settings.orientation}`), count: page.elements.length > 0 ? new Set(page.elements.map((element) => element.transform)).size : 0 })} />
        <Text style={styles.meta}>{t('stencil.marginNote')}</Text>

        {radio(t('stencil.orientationTitle'), ORIENTATIONS, settings.orientation, (option) => t(`stencil.orientation.${option}`), (orientation) => update({ orientation }), 'orientation')}
        {radio(t('stencil.thicknessTitle'), THICKNESSES, settings.thickness, (option) => t(`stencil.thickness.${option}`, { mm: THICKNESS_MM[option] }), (thickness) => update({ thickness }), 'thickness')}
        <Text style={styles.section}>{t('stencil.extrasTitle')}</Text>
        {check(t('stencil.guides'), settings.guides, () => update({ guides: !settings.guides }), 'stencil-guides')}
        <Text style={styles.section}>{t('stencil.labelsTitle')}</Text>
        {LABEL_FIELDS.map((field) => check(field === 'name' && !design.name ? t('stencil.labels.nameNone') : t(`stencil.labels.${field}`), settings.labels.includes(field), () => toggleLabel(field), `stencil-label-${field}`, field === 'name' && !design.name))}
        <Text style={styles.meta}>{t('stencil.labelsNote')}</Text>

        {page.limitations.length ? (
          <View style={styles.card} testID="stencil-limitations">
            <Text style={styles.cardTitle}>{t('stencil.limitsTitle')}</Text>
            {page.limitations.map((limit) => (
              <Text key={limit.kind} style={styles.meta} testID={`stencil-limit-${limit.kind}`}>
                {t(`stencil.limits.${limit.kind}`, { motifs: limit.motifIds.map(motifName).join(', ') })}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.card} testID="stencil-output-facts">
          <Text style={styles.cardTitle}>{t('stencil.outputTitle')}</Text>
          <Text style={styles.meta}>{t('stencil.outputFormat', { orientation: t(`stencil.orientation.${settings.orientation}`) })}</Text>
          <Text style={styles.meta}>{t('stencil.outputSize', { mm: printedDesignMm(settings.orientation), margin: Math.round(SAFE_MARGIN * (25.4 / 72) * 10) / 10 })}</Text>
        </View>

        {supported ? (
          <Button label={exportState === 'failed' || exportState === 'unavailable' ? t('stencil.retry') : t('stencil.export')} loading={exportState === 'exporting'} disabled={page.elements.length === 0} onPress={exportPdf} testID="stencil-export" />
        ) : (
          <Text style={styles.note} testID="stencil-export-unsupported">
            {t('stencil.unsupported')}
          </Text>
        )}
        {exportState === 'failed' ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite" testID="stencil-export-failed">
            {t('stencil.exportFailed')}
          </Text>
        ) : null}
        {exportState === 'unavailable' ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite" testID="stencil-share-unavailable">
            {t('stencil.shareUnavailable')}
          </Text>
        ) : null}
        {exportState === 'done' ? (
          <Text style={styles.meta} accessibilityLiveRegion="polite" testID="stencil-exported">
            {t('stencil.exported')}
          </Text>
        ) : null}
        <Text style={styles.meta}>{t('stencil.originalNote')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>{body}</ScrollView>
    </View>
  );
}

/** The SAME page description the PDF prints, drawn with react-native-svg (the dashed safe margin is preview-only). */
export function StencilPreview({ page, width, label }: { page: StencilPage; width: number; label: string }) {
  const height = (width * page.height) / page.width;
  const guideWidth = 0.6 / (page.box.size / CANVAS);
  return (
    <View style={[styles.paper, { width, height }]} accessible accessibilityRole="image" accessibilityLabel={label} testID="stencil-preview">
      <Svg width={width} height={height} viewBox={`0 0 ${page.width} ${page.height}`}>
        <Rect width={page.width} height={page.height} fill="#fff" />
        <Rect x={SAFE_MARGIN} y={SAFE_MARGIN} width={page.width - 2 * SAFE_MARGIN} height={page.height - 2 * SAFE_MARGIN} fill="none" stroke="#9BB7D4" strokeWidth={1} strokeDasharray="4 4" />
        <Defs>
          <ClipPath id="stencil-design">
            <Rect x={0} y={0} width={CANVAS} height={CANVAS} />
          </ClipPath>
        </Defs>
        <G transform={page.designTransform}>
          <G clipPath="url(#stencil-design)">
            {page.guides.map((g, index) => (
              <Line key={`g${index}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#888" strokeWidth={guideWidth} strokeDasharray={`${guideWidth * 6} ${guideWidth * 6}`} />
            ))}
            {page.elements.map((element, index) =>
              element.kind === 'path' ? (
                <Path key={index} d={element.d} transform={element.transform} fill="none" stroke="#000" strokeWidth={element.strokeWidth} strokeLinecap={element.cap} strokeLinejoin={element.join} />
              ) : (
                <Circle key={index} cx={element.cx} cy={element.cy} r={element.r} transform={element.transform} fill={element.filled ? '#000' : 'none'} stroke="#000" strokeWidth={element.strokeWidth} />
              ),
            )}
          </G>
        </G>
        {labelLines(page).map((line, index) => (
          <SvgText key={`l${index}`} x={line.x} y={line.y} fontSize={line.size} textAnchor="middle" fill="#000">
            {line.text}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  stack: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  section: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xs },
  body: { ...textStyles.body, color: colors.textPrimary },
  meta: { ...textStyles.small, color: colors.textSecondary },
  warn: { ...textStyles.small, fontWeight: '700', color: colors.accentTerracottaText },
  note: { ...textStyles.small, color: colors.textPrimary, padding: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.xs, padding: spacing.md, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  cardTitle: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  paper: { alignSelf: 'center', borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: '#fff' },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...textStyles.bodyMedium, color: colors.textPrimary },
  chipTextOn: { color: colors.textOnPrimary, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  disabled: { opacity: 0.55 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
});
