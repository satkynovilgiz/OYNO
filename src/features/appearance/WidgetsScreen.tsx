import { ChevronLeft, Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { Chip, IconButton } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import type { PublicWidgetSnapshot, WidgetCard } from '@/services/widgets/publicWidgetSnapshot';
import { cardRadii, colors, fontFamily, radii, spacing, textStyles, typography } from '@/theme';

import { WIDGET_CATALOG, widgetAvailability } from './widgetCatalog';

import { useWidgetSnapshot } from './useWidgetSnapshot';

const GAP = spacing.sm;

/**
 * OYNO Widget gallery - previews of the one Home Screen widget, "Today in
 * OYNO" (small + medium), rendered from the SAME public snapshot the
 * native widget reads (useWidgetSnapshot), plus its bundled fallback.
 * It never says a widget is installed when the build has no extension.
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
            <Labeled label={t('widget.name')} family={t('appearance.widgets.families.small')}>
              <TodaySmall snapshot={snapshot} size={small} />
            </Labeled>
            <Labeled label={t('widget.fallbackLabel')} family={t('appearance.widgets.families.small')}>
              <TodaySmall snapshot={{ ...snapshot, primary: null }} size={small} />
            </Labeled>
          </View>
          <Labeled label={t('widget.name')} family={t('appearance.widgets.families.medium')}>
            <TodayMedium snapshot={snapshot} width={medium} height={small} />
          </Labeled>
        </View>
        <Text style={styles.privacy}>{t('widget.privacyNote')}</Text>

        {/* Sizes - the same list the native extension declares. */}
        <Text style={styles.sectionTitle}>{t('appearance.v2.sizes')}</Text>
        <View style={styles.sizes}>
          {WIDGET_CATALOG.map((entry, index) => (
            <View key={entry.kind} style={[styles.sizeRow, index > 0 && styles.sizeDivider]} accessible accessibilityLabel={`${t('widget.name')}: ${entry.families.map((family) => t(`appearance.widgets.families.${family}`)).join(', ')}`}>
              <Text style={styles.sizeName}>{t('widget.name')}</Text>
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
function WidgetShell({ width, height, a11y, children }: { width: number; height: number; a11y: string; children: ReactNode }) {
  return (
    <View style={[styles.shell, { width, height }]} accessible accessibilityLabel={a11y}>
      {children}
    </View>
  );
}

function CardText({ card, titleLines, compact = false }: { card: WidgetCard; titleLines: number; compact?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.eyebrowRow}>
        <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.75} />
        <Text style={styles.eyebrow} numberOfLines={1}>
          {card.eyebrow}
        </Text>
      </View>
      <Text style={compact ? styles.compactTitle : styles.smallTitle} numberOfLines={titleLines}>
        {card.title}
      </Text>
      {card.subtitle && !compact ? (
        <Text style={styles.meta} numberOfLines={1}>
          {card.subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function Fallback({ snapshot }: { snapshot: PublicWidgetSnapshot }) {
  return (
    <View style={[styles.shellContent, styles.spread]}>
      <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.75} />
      <View style={{ gap: 2 }}>
        <Text style={styles.smallTitle} numberOfLines={2}>
          {snapshot.labels.fallbackTitle}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {snapshot.labels.fallbackSubtitle}
        </Text>
      </View>
    </View>
  );
}

const cardA11y = (card: WidgetCard | null, snapshot: PublicWidgetSnapshot) => (card ? `${card.eyebrow}. ${card.title}${card.subtitle ? `, ${card.subtitle}` : ''}` : `${snapshot.labels.fallbackTitle}. ${snapshot.labels.fallbackSubtitle}`);

function TodaySmall({ snapshot, size }: { snapshot: PublicWidgetSnapshot; size: number }) {
  const { t } = useTranslation();
  const primary = snapshot.primary;
  return (
    <WidgetShell width={size} height={size} a11y={`${t('widget.name')}, ${t('appearance.widgets.families.small')}. ${cardA11y(primary, snapshot)}`}>
      {primary ? (
        <View style={[styles.shellContent, styles.spread]}>
          <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.75} />
          <CardText card={primary} titleLines={3} />
        </View>
      ) : (
        <Fallback snapshot={snapshot} />
      )}
    </WidgetShell>
  );
}

function TodayMedium({ snapshot, width, height }: { snapshot: PublicWidgetSnapshot; width: number; height: number }) {
  const { t } = useTranslation();
  const { primary, secondary } = snapshot;
  const a11y = `${t('widget.name')}, ${t('appearance.widgets.families.medium')}. ${cardA11y(primary, snapshot)}${secondary ? `. ${cardA11y(secondary, snapshot)}` : ''}`;
  return (
    <WidgetShell width={width} height={height} a11y={a11y}>
      <View style={[styles.shellContent, styles.mediumRow]}>
        <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'flex-end' }}>{primary ? <CardText card={primary} titleLines={3} /> : <Fallback snapshot={snapshot} />}</View>
        {secondary ? (
          <View style={[styles.secondary, { width: Math.round(width * 0.36) }]}>
            <CardText card={secondary} titleLines={3} compact />
          </View>
        ) : null}
      </View>
    </WidgetShell>
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
  privacy: { ...textStyles.caption, color: colors.textSecondary },
  compactTitle: { ...typography.caption, fontWeight: '700', color: colors.textOnDark },
  secondary: { alignSelf: 'stretch', justifyContent: 'flex-end', padding: spacing.sm, borderRadius: 14, backgroundColor: 'rgba(47,82,51,0.9)' },
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
  shellContent: { flex: 1, padding: spacing.md, justifyContent: 'flex-end', gap: 2 },
  spread: { justifyContent: 'space-between' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...typography.overline, fontSize: 9, color: colors.accentGold },
  smallTitle: { ...typography.bodyBold, fontFamily: fontFamily.wordmark, color: colors.surface },
  meta: { ...typography.small, color: 'rgba(251,243,227,0.75)' },
  mediumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.md },
});
