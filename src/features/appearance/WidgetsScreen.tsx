import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ImageBackground, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Chip, IconButton, ProgressRing } from '@/components/ui';
import { cultureItemImages, cultureMaterialImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import type { WidgetSnapshot } from '@/services/widgets/widgetSnapshot';
import { cardRadii, colors, fontFamily, radii, spacing, textStyles, typography } from '@/theme';

import { WIDGET_CATALOG, widgetAvailability } from './widgetCatalog';

import { useWidgetSnapshot } from './useWidgetSnapshot';

const GAP = spacing.sm;

/**
 * OYNO Widgets gallery - previews of the Home Screen (small/medium) and
 * Lock Screen (inline/circular/rectangular) widgets, rendered from the
 * real widget snapshot (useWidgetSnapshot). It never says a widget is
 * installed: native widgets need a WidgetKit extension that isn't in the
 * app yet, and the note at the top says so plainly.
 */
export function WidgetsScreen({ onPressBack }: { onPressBack: () => void }) {
  useTrackScreenView('appearance_widgets');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const snapshot = useWidgetSnapshot();
  const availability = widgetAvailability();

  const inner = Math.min(width, 520) - spacing.md * 2 - spacing.md * 2;
  const small = Math.min(170, Math.floor((inner - GAP) / 2));
  const medium = small * 2 + GAP;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <Text style={styles.title}>{t('appearance.widgets.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* Honest status: previews always; "installed" only in an iOS build
            that really contains the widget extension. */}
        {availability === 'unavailable' ? (
          <View style={styles.note}>
            <Info size={16} color={colors.primary} strokeWidth={2.25} />
            <Text style={styles.noteText}>{Platform.OS === 'ios' ? t('appearance.widgets.previewNote') : t('appearance.v2.unavailable')}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('appearance.widgets.homeScreen')}</Text>
        <View style={styles.homeCanvas}>
          <View style={styles.row}>
            <Labeled label={t('appearance.widgets.types.daily')} family={t('appearance.widgets.families.small')}>
              <DailySmall snapshot={snapshot} size={small} />
            </Labeled>
            <Labeled label={t('appearance.widgets.types.passport')} family={t('appearance.widgets.families.small')}>
              <PassportSmall snapshot={snapshot} size={small} />
            </Labeled>
          </View>
          <Labeled label={t('appearance.widgets.types.journey')} family={t('appearance.widgets.families.medium')}>
            <JourneyMedium snapshot={snapshot} width={medium} height={small} />
          </Labeled>
          <View style={styles.row}>
            <Labeled label={t('appearance.widgets.types.trail')} family={t('appearance.widgets.families.small')}>
              <TrailSmall snapshot={snapshot} size={small} />
            </Labeled>
          </View>
          <Labeled label={t('appearance.widgets.types.cultureOfDay')} family={t('appearance.widgets.families.medium')}>
            <CultureMedium snapshot={snapshot} width={medium} height={small} />
          </Labeled>
        </View>

        <Text style={styles.sectionTitle}>{t('appearance.widgets.lockScreen')}</Text>
        <ImageBackground source={natureSiteImages['ala-too']} style={styles.lockCanvas} imageStyle={styles.lockCanvasImage} resizeMode="cover">
          <View style={styles.lockShade} />
          <LockInline snapshot={snapshot} />
          <Text style={styles.lockClock} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {`${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}`}
          </Text>
          <View style={styles.lockRow}>
            <LockCircular snapshot={snapshot} />
            <LockRectangular snapshot={snapshot} />
          </View>
          <Text style={styles.lockCaption}>{t('appearance.widgets.lockCaption')}</Text>
        </ImageBackground>

        {/* Sizes - the same list the native extension declares. */}
        <Text style={styles.sectionTitle}>{t('appearance.v2.sizes')}</Text>
        <View style={styles.sizes}>
          {WIDGET_CATALOG.map((entry, index) => (
            <View key={entry.kind} style={[styles.sizeRow, index > 0 && styles.sizeDivider]} accessible accessibilityLabel={`${t(`appearance.widgets.types.${entry.kind}`)}: ${entry.families.map((family) => t(`appearance.widgets.families.${family}`)).join(', ')}`}>
              <Text style={styles.sizeName}>{t(`appearance.widgets.types.${entry.kind}`)}</Text>
              <View style={styles.sizeChips}>
                {entry.families.map((family) => (
                  <Chip key={family} label={t(`appearance.widgets.families.${family}`)} />
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* How to add - OYNO can't add widgets for the user. */}
        <Text style={styles.sectionTitle}>{t('appearance.v2.installTitle')}</Text>
        <View style={styles.sizes}>
          {(t('appearance.v2.installSteps', { returnObjects: true }) as string[]).map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.lockHint}>{t('appearance.v2.lockHint')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Labeled({ label, family, children }: { label: string; family: string; children: ReactNode }) {
  return (
    <View style={styles.labeled}>
      {children}
      <Text style={styles.widgetLabel} numberOfLines={1}>
        {label} · {family}
      </Text>
    </View>
  );
}

/** Shared widget chrome: deep green, rounded like iOS widgets, one oymo mark. */
function WidgetShell({ width, height, a11y, children, dark = true }: { width: number; height: number; a11y: string; children: ReactNode; dark?: boolean }) {
  return (
    <View style={[styles.shell, { width, height }, !dark && styles.shellLight]} accessible accessibilityLabel={a11y}>
      {children}
    </View>
  );
}

function DailySmall({ snapshot, size }: { snapshot: WidgetSnapshot; size: number }) {
  const { t } = useTranslation();
  const daily = snapshot.daily;
  const image = daily ? cultureItemImages[daily.itemId]?.[0] : null;
  const a11y = `${t('appearance.widgets.types.daily')}, ${t('appearance.widgets.families.small')}. ${daily ? daily.title : t('appearance.widgets.noData')}`;
  return (
    <WidgetShell width={size} height={size} a11y={a11y}>
      {image ? <Image source={image} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <LinearGradient colors={['rgba(19,32,24,0.05)', 'rgba(19,32,24,0.9)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.shellContent}>
        <Text style={styles.eyebrow}>{t('daily.entry.overline')}</Text>
        <Text style={styles.smallTitle} numberOfLines={2}>
          {daily ? daily.title : t('appearance.widgets.noData')}
        </Text>
        {daily?.isCompleted ? <Text style={styles.meta}>✓ {t('daily.entry.done')}</Text> : null}
      </View>
    </WidgetShell>
  );
}

function PassportSmall({ snapshot, size }: { snapshot: WidgetSnapshot; size: number }) {
  const { t } = useTranslation();
  const { unlocked, total } = snapshot.passport;
  const a11y = `${t('appearance.widgets.types.passport')}, ${t('appearance.widgets.families.small')}. ${t('explore.map.summary', { unlocked, total })}`;
  return (
    <WidgetShell width={size} height={size} a11y={a11y}>
      <View style={[styles.shellContent, styles.spread]}>
        <View style={styles.eyebrowRow}>
          <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.75} />
          <Text style={styles.eyebrow}>{t('appearance.widgets.types.passport')}</Text>
        </View>
        <Text style={styles.bigNumber}>
          {unlocked}
          <Text style={styles.bigNumberTotal}> / {total}</Text>
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, index) => (
            <View key={index} style={[styles.dot, index < unlocked && styles.dotOn]} />
          ))}
        </View>
      </View>
    </WidgetShell>
  );
}

function TrailSmall({ snapshot, size }: { snapshot: WidgetSnapshot; size: number }) {
  const { t } = useTranslation();
  const trail = snapshot.trail;
  const a11y = `${t('appearance.widgets.types.trail')}, ${t('appearance.widgets.families.small')}. ${
    trail ? `${trail.title}, ${t('trails.progress', { completed: trail.completed, total: trail.total })}` : t('appearance.widgets.noActiveTrail')
  }`;
  return (
    <WidgetShell width={size} height={size} a11y={a11y}>
      <View style={[styles.shellContent, styles.spread]}>
        <View style={styles.eyebrowRow}>
          <OymoOrnament size={11} color={colors.accentGold} strokeWidth={1.75} />
          <Text style={styles.eyebrow}>{t('appearance.widgets.types.trail')}</Text>
        </View>
        {trail ? (
          <>
            <Text style={styles.smallTitle} numberOfLines={2}>
              {trail.title}
            </Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${(trail.completed / Math.max(1, trail.total)) * 100}%` }]} />
            </View>
            <Text style={styles.meta}>
              {trail.completed} / {trail.total}
            </Text>
          </>
        ) : (
          <Text style={styles.meta}>{t('appearance.widgets.noActiveTrail')}</Text>
        )}
      </View>
    </WidgetShell>
  );
}

function JourneyMedium({ snapshot, width, height }: { snapshot: WidgetSnapshot; width: number; height: number }) {
  const { t } = useTranslation();
  const { journey } = snapshot;
  const progress = journey.progress;
  const a11y = `${t('appearance.widgets.types.journey')}, ${t('appearance.widgets.families.medium')}. ${journey.eyebrow}: ${journey.title}${
    progress ? `, ${progress.completed} / ${progress.total}` : ''
  }`;
  return (
    <WidgetShell width={width} height={height} a11y={a11y}>
      <View style={[styles.shellContent, styles.mediumRow]}>
        {progress && progress.total > 0 ? (
          <ProgressRing progress={progress.completed / progress.total} size={height * 0.5} strokeWidth={5} trackColor="rgba(255,255,255,0.16)" fillColor={colors.accentGold}>
            <Text style={styles.ringText}>
              {progress.completed}/{progress.total}
            </Text>
          </ProgressRing>
        ) : (
          <View style={[styles.ornamentDisc, { width: height * 0.5, height: height * 0.5, borderRadius: height * 0.25 }]}>
            <OymoOrnament size={height * 0.2} color={colors.accentGold} strokeWidth={1.5} />
          </View>
        )}
        <View style={styles.mediumText}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {journey.eyebrow}
          </Text>
          <Text style={styles.mediumTitle} numberOfLines={2}>
            {journey.title}
          </Text>
        </View>
      </View>
    </WidgetShell>
  );
}

function CultureMedium({ snapshot, width, height }: { snapshot: WidgetSnapshot; width: number; height: number }) {
  const { t } = useTranslation();
  const culture = snapshot.cultureOfDay;
  const image = culture ? cultureMaterialImages[culture.id] : null;
  const a11y = `${t('appearance.widgets.types.cultureOfDay')}, ${t('appearance.widgets.families.medium')}. ${culture ? culture.title : t('appearance.widgets.noData')}`;
  return (
    <WidgetShell width={width} height={height} a11y={a11y}>
      <View style={[styles.shellContent, styles.mediumRow]}>
        {image ? <Image source={image} style={[styles.cultureImage, { width: height - spacing.md * 2, height: height - spacing.md * 2 }]} resizeMode="cover" /> : null}
        <View style={styles.mediumText}>
          <Text style={styles.eyebrow}>{t('appearance.widgets.types.cultureOfDay')}</Text>
          <Text style={styles.mediumTitle} numberOfLines={1}>
            {culture ? culture.title : t('appearance.widgets.noData')}
          </Text>
          {culture?.description ? (
            <Text style={styles.meta} numberOfLines={2}>
              {culture.description}
            </Text>
          ) : null}
        </View>
      </View>
    </WidgetShell>
  );
}

function LockInline({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { t } = useTranslation();
  const text = `OYNO · ${t('appearance.widgets.types.passport')} ${snapshot.passport.unlocked}/${snapshot.passport.total}`;
  return (
    <View accessible accessibilityLabel={`${t('appearance.widgets.families.inline')}. ${text}`}>
      <Text style={styles.lockInline}>◆ {text}</Text>
    </View>
  );
}

function LockCircular({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { t } = useTranslation();
  const { unlocked, total } = snapshot.passport;
  return (
    <View
      style={styles.lockCircle}
      accessible
      accessibilityLabel={`${t('appearance.widgets.types.passport')}, ${t('appearance.widgets.families.circular')}. ${t('explore.map.summary', { unlocked, total })}`}
    >
      <ProgressRing progress={total > 0 ? unlocked / total : 0} size={64} strokeWidth={5} trackColor="rgba(255,255,255,0.25)" fillColor={colors.textOnDark}>
        <Text style={styles.lockCircleText}>
          {unlocked}/{total}
        </Text>
      </ProgressRing>
    </View>
  );
}

function LockRectangular({ snapshot }: { snapshot: WidgetSnapshot }) {
  const { t } = useTranslation();
  const daily = snapshot.daily;
  return (
    <View
      style={styles.lockRect}
      accessible
      accessibilityLabel={`${t('appearance.widgets.types.daily')}, ${t('appearance.widgets.families.rectangular')}. ${daily ? daily.title : t('appearance.widgets.noData')}`}
    >
      <Text style={styles.lockRectEyebrow}>◆ {t('daily.entry.title')}</Text>
      <Text style={styles.lockRectTitle} numberOfLines={1}>
        {daily ? daily.title : t('appearance.widgets.noData')}
      </Text>
      {daily ? <Text style={styles.lockRectMeta}>{daily.isCompleted ? `✓ ${t('daily.entry.done')}` : t('daily.minutes', { count: daily.minutes })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sizes: { padding: spacing.md, gap: spacing.sm, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  sizeRow: { gap: 6 },
  sizeDivider: { paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.borderSubtle },
  sizeName: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  sizeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  stepNumberText: { ...textStyles.small, color: colors.textOnDark },
  stepText: { ...textStyles.body, color: colors.textPrimary, flex: 1 },
  lockHint: { ...textStyles.caption, color: colors.textSecondary, marginTop: spacing.xs },
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary, flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  note: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surfaceWarm },
  noteText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  sectionTitle: { ...typography.overline, color: colors.accentTerracotta, marginTop: spacing.xs },
  homeCanvas: { padding: spacing.md, borderRadius: radii.xxl, backgroundColor: '#22332A', gap: spacing.md, alignItems: 'center' },
  row: { flexDirection: 'row', gap: GAP, alignSelf: 'stretch', justifyContent: 'center' },
  labeled: { alignItems: 'center', gap: 6 },
  widgetLabel: { ...typography.small, color: 'rgba(251,243,227,0.75)' },
  shell: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.surfaceFeature, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(232,185,61,0.3)' },
  shellLight: { backgroundColor: colors.surface },
  shellContent: { flex: 1, padding: spacing.md, justifyContent: 'flex-end', gap: 2 },
  spread: { justifyContent: 'space-between' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...typography.overline, fontSize: 9, color: colors.accentGold },
  smallTitle: { ...typography.bodyBold, fontFamily: fontFamily.wordmark, color: colors.surface },
  meta: { ...typography.small, color: 'rgba(251,243,227,0.75)' },
  bigNumber: { fontFamily: fontFamily.wordmark, fontSize: 38, lineHeight: 42, fontWeight: '700', color: colors.accentGold },
  bigNumberTotal: { fontSize: 18, color: 'rgba(251,243,227,0.7)' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(232,185,61,0.6)' },
  dotOn: { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accentGold },
  mediumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.md },
  mediumText: { flex: 1, gap: 3 },
  mediumTitle: { ...typography.h2, fontFamily: fontFamily.wordmark, color: colors.textOnDark },
  ringText: { ...typography.small, color: colors.textOnDark },
  ornamentDisc: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(232,185,61,0.5)' },
  cultureImage: { borderRadius: 16 },
  lockCanvas: { borderRadius: radii.xxl, overflow: 'hidden', padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  lockCanvasImage: { borderRadius: radii.xxl },
  lockShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(19,32,24,0.25)' },
  lockInline: { ...typography.caption, fontWeight: '700', color: colors.textOnDark },
  lockClock: { fontSize: 64, lineHeight: 70, fontWeight: '700', color: colors.textOnDark },
  lockRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  lockCircle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  lockCircleText: { ...typography.small, color: colors.textOnDark },
  lockRect: { width: 170, height: 76, borderRadius: 18, padding: spacing.sm, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  lockRectEyebrow: { ...typography.small, color: 'rgba(255,255,255,0.85)' },
  lockRectTitle: { ...typography.bodyBold, color: colors.textOnDark },
  lockRectMeta: { ...typography.small, color: 'rgba(255,255,255,0.8)' },
  lockCaption: { ...typography.small, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs, textAlign: 'center' },
});
