import { ArrowDownToLine, Check, RotateCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { showToast } from '@/components/ui/Toast';
import { downloadId, type OfflineKind } from '@/services/offline/offlineManifest';
import { useDownloadState, useOfflineStore } from '@/services/offline/useOfflineStore';
import { colors, radii, spacing, typography } from '@/theme';

type DownloadButtonProps = {
  kind: OfflineKind;
  contentId: string;
  /** Content name, for the accessibility label ("Download Son-Kol…"). */
  title: string;
};

/**
 * "Download for offline" control with the real download state:
 * not_downloaded -> Download for offline, downloading -> Downloading…,
 * downloaded -> Available offline (+ Remove download), error -> Retry.
 * Removing only deletes the offline copy (see useOfflineStore.remove).
 */
export function DownloadButton({ kind, contentId, title }: DownloadButtonProps) {
  const { t } = useTranslation();
  const state = useDownloadState(kind, contentId);
  const store = useOfflineStore.getState();

  if (state === 'downloaded') {
    return (
      <View style={styles.row}>
        <View style={styles.available} accessible accessibilityLabel={t('offline.a11y.available', { title })}>
          <Check size={14} color={colors.primary} strokeWidth={3} />
          <Text style={styles.availableText}>{t('offline.available')}</Text>
        </View>
        <AnimatedPressable
          style={styles.removeLink}
          onPress={() => void store.remove(downloadId(kind, contentId))}
          accessibilityRole="button"
          accessibilityLabel={t('offline.a11y.remove', { title })}
        >
          <Text style={styles.removeText}>{t('offline.remove')}</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const downloading = state === 'downloading';
  const failed = state === 'error';
  return (
    <AnimatedPressable
      style={[styles.button, failed && styles.buttonError]}
      onPress={() => void store.download(kind, contentId).then((ok) => ok && showToast(t('toast.downloaded'), { haptic: true }))}
      disabled={downloading}
      press="strong"
      accessibilityRole="button"
      accessibilityState={{ busy: downloading, disabled: downloading }}
      accessibilityLabel={failed ? t('offline.a11y.retry', { title }) : t('offline.a11y.download', { title })}
    >
      {downloading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : failed ? (
        <RotateCw size={15} color={colors.accentTerracotta} strokeWidth={2.25} />
      ) : (
        <ArrowDownToLine size={15} color={colors.primary} strokeWidth={2.25} />
      )}
      <Text style={[styles.buttonText, failed && styles.buttonTextError]}>
        {downloading ? t('offline.downloading') : failed ? t('offline.retry') : t('offline.download')}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(47,82,51,0.35)',
    backgroundColor: colors.surface,
  },
  buttonError: {
    borderColor: 'rgba(185,98,47,0.5)',
  },
  buttonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  buttonTextError: {
    color: colors.accentTerracotta,
  },
  available: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  availableText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  removeLink: {
    paddingVertical: spacing.xxs,
  },
  removeText: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
