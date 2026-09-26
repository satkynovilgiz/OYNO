import { CheckCircle2, CloudOff, RotateCw, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import type { OfflineRowState } from '@/services/offline/offlineModel';
import { cardRadii, colors, spacing, textStyles } from '@/theme';

type OfflineContentRowProps = {
  title: string;
  typeLabel: string;
  image: ImageSourcePropType | null;
  state: OfflineRowState;
  /** Already formatted "Saved 24-сен." - only when the manifest has a date. */
  savedLabel?: string | null;
  large?: boolean;
  compact?: boolean;
  onOpen?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
};

/**
 * One downloaded (or downloading / failed) item: artwork, title, type, and
 * its real state - "Available offline" with a quiet check, an indeterminate
 * spinner while downloading (the download layer has no byte progress, so
 * no percentage is ever shown), or "Download didn't finish" with Retry and
 * Remove. Tapping an available item opens its real detail screen.
 */
export function OfflineContentRow({ title, typeLabel, image, state, savedLabel, large = false, compact = false, onOpen, onRemove, onRetry }: OfflineContentRowProps) {
  const { t } = useTranslation();
  const size = large ? 64 : 52;
  const status =
    state === 'available' ? t('offline.available') : state === 'downloading' ? t('offline.downloading') : state === 'failed' ? t('offline.v2.failed') : t('offline.v2.removing');
  const a11y = [title, status, savedLabel ?? typeLabel].filter(Boolean).join('. ');

  return (
    <View style={[styles.row, state === 'failed' && styles.rowFailed, large && styles.rowLarge]}>
      <AnimatedPressable style={styles.main} onPress={state === 'available' ? onOpen : undefined} disabled={state !== 'available'} press="soft" accessibilityRole="button" accessibilityLabel={a11y}>
        {image ? (
          <Image source={image} style={[styles.thumb, { width: size, height: size }, state !== 'available' && styles.thumbMuted]} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { width: size, height: size }]}>
            <OymoOrnament size={16} color={colors.accentGold} strokeWidth={1.5} />
          </View>
        )}
        <View style={styles.text}>
          <Text style={[styles.title, large && styles.titleLarge]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.statusRow}>
            {state === 'available' ? <CheckCircle2 size={13} color={colors.success} strokeWidth={2.5} /> : null}
            {state === 'downloading' || state === 'removing' ? <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} /> : null}
            {state === 'failed' ? <CloudOff size={13} color={colors.accentTerracotta} strokeWidth={2.5} /> : null}
            <Text style={[styles.status, state === 'available' && styles.statusOk, state === 'failed' && styles.statusFailed]} numberOfLines={1}>
              {status}
            </Text>
          </View>
          {/* Type (and real save date) on its own line so long KG/RU labels never cut the status. */}
          {savedLabel && !compact ? (
            <Text style={styles.saved} numberOfLines={1}>
              {savedLabel}
            </Text>
          ) : compact ? (
            <Text style={styles.saved} numberOfLines={1}>
              {typeLabel}
            </Text>
          ) : null}
        </View>
      </AnimatedPressable>

      {state === 'available' && onRemove ? (
        <IconButton icon={Trash2} size={40} iconSize={17} elevated={false} accessibilityLabel={t('offline.a11y.remove', { title })} onPress={onRemove} />
      ) : null}
      {state === 'failed' ? (
        <View style={styles.failedActions}>
          {onRetry ? <Button label={t('offline.retry')} icon={<RotateCw size={14} color={colors.textPrimary} strokeWidth={2.5} />} variant="accent" size="sm" onPress={onRetry} /> : null}
          {onRemove ? <IconButton icon={Trash2} size={36} iconSize={16} elevated={false} accessibilityLabel={t('offline.a11y.remove', { title })} onPress={onRemove} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 72, paddingVertical: spacing.xs, paddingLeft: spacing.xs, paddingRight: spacing.xxs, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceElevated },
  rowLarge: { minHeight: 88 },
  rowFailed: { backgroundColor: 'rgba(185,98,47,0.07)' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  thumb: { borderRadius: 14, backgroundColor: colors.surfaceMuted },
  thumbMuted: { opacity: 0.55 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  text: { flex: 1, gap: 3, minWidth: 0 },
  title: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary },
  titleLarge: { fontSize: 17, lineHeight: 23 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  spinner: { transform: [{ scale: 0.7 }], width: 14, height: 14 },
  status: { ...textStyles.caption, color: colors.textSecondary, flexShrink: 1 },
  statusOk: { color: colors.success, fontWeight: '600' },
  statusFailed: { color: colors.accentTerracotta, fontWeight: '600' },
  saved: { ...textStyles.small, color: colors.textMuted },
  failedActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
