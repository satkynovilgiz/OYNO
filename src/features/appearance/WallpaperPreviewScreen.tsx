import { ChevronLeft, Download, Heart, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, IconButton } from '@/components/ui';
import { useTrackScreenView } from '@/services/analytics/useTrackScreenView';
import { saveWallpaper, shareWallpaper, type SaveResult } from '@/services/wallpaper/wallpaperActions';
import { useWallpaperFavoritesStore } from '@/store/useWallpaperFavoritesStore';
import { colors, fontFamily, radii, spacing, typography } from '@/theme';

import type { Wallpaper } from './wallpapers';
import { showToast } from '@/components/ui/Toast';
import { wallpaperSaveFeedback } from './wallpaperFeedback';

const LOCALE: Record<string, string> = { kg: 'ky-KG', ru: 'ru-RU', en: 'en-US' };

function formatClock(date: Date, language: string): { time: string; day: string } {
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  let day = '';
  try {
    day = date.toLocaleDateString(LOCALE[language] ?? 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    day = '';
  }
  return { time, day };
}

/**
 * Full-screen wallpaper preview with a lock-screen style clock (the
 * device's real time) so the photo reads as a phone screen. Actions are
 * honest: "Save Wallpaper" saves to Photos - the user sets it as their
 * wallpaper there; OYNO can't set system wallpapers.
 */
export function WallpaperPreviewScreen({ wallpaper, onPressBack }: { wallpaper: Wallpaper; onPressBack: () => void }) {
  useTrackScreenView('appearance_wallpaper_preview');
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const favorite = useWallpaperFavoritesStore((state) => state.ids.includes(wallpaper.id));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [now, setNow] = useState(() => new Date());
  const name = t(wallpaper.titleKey);

  useEffect(() => {
    if (!useWallpaperFavoritesStore.getState().isLoaded) void useWallpaperFavoritesStore.getState().load();
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const outcome = await saveWallpaper(wallpaper.image, `oyno-${wallpaper.id}`);
    setResult(outcome);
    setSaving(false);
    if (wallpaperSaveFeedback(outcome).toast) showToast(t(`appearance.wallpapers.result.${outcome}`), { haptic: true });
  }

  const clock = formatClock(now, i18n.language);

  return (
    <View style={styles.root}>
      <Image source={wallpaper.image} style={styles.image} resizeMode="cover" accessibilityLabel={t('appearance.wallpapers.a11yPreview', { name })} />
      <View style={styles.topShade} pointerEvents="none" />
      <View style={styles.bottomShade} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={ChevronLeft} shape="roundedSquare" variant="surface" accessibilityLabel={t('common.back')} onPress={onPressBack} />
        <IconButton
          icon={Heart}
          shape="roundedSquare"
          variant={favorite ? 'primary' : 'surface'}
          accessibilityLabel={favorite ? t('appearance.wallpapers.unfavorite', { name }) : t('appearance.wallpapers.favorite', { name })}
          onPress={() => void useWallpaperFavoritesStore.getState().toggle(wallpaper.id)}
        />
      </View>

      <View style={styles.clock} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.clockDay}>{clock.day}</Text>
        <Text style={styles.clockTime}>{clock.time}</Text>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.hint}>{wallpaper.portrait ? t('appearance.wallpapers.saveHint') : t('appearance.wallpapers.saveHintLandscape')}</Text>

        {result ? (
          <Text style={[styles.status, (result === 'saved' || result === 'downloaded') && styles.statusOk]} accessibilityLiveRegion="polite">
            {t(`appearance.wallpapers.result.${result}`)}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <AnimatedPressable
            style={[styles.primary, saving && styles.disabled]}
            onPress={() => void handleSave()}
            disabled={saving}
            pressScale={0.97}
            haptic="light"
            accessibilityRole="button"
            accessibilityState={{ busy: saving }}
            accessibilityLabel={t('appearance.wallpapers.save')}
          >
            {saving ? <ActivityIndicator color={colors.accentGold} /> : <Download size={18} color={colors.accentGold} strokeWidth={2.25} />}
            <Text style={styles.primaryText}>{t('appearance.wallpapers.save')}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.secondary}
            onPress={() => void shareWallpaper(wallpaper.image, name, t('appearance.wallpapers.shareMessage', { name }))}
            pressScale={0.97}
            accessibilityRole="button"
            accessibilityLabel={t('share.action')}
          >
            <Share2 size={18} color={colors.primary} strokeWidth={2.25} />
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceFeature },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, backgroundColor: 'rgba(19,32,24,0.18)' },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, backgroundColor: 'rgba(19,32,24,0.25)' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  clock: { alignItems: 'center', marginTop: spacing.lg },
  clockDay: { ...typography.bodyBold, color: 'rgba(255,255,255,0.92)', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  clockTime: { fontSize: 76, lineHeight: 84, fontWeight: '700', color: colors.textOnDark, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 },
  sheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    padding: spacing.md,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    backgroundColor: 'rgba(251,243,227,0.95)',
    gap: spacing.xs,
  },
  name: { ...typography.h1, fontFamily: fontFamily.wordmark, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
  status: { ...typography.caption, fontWeight: '700', color: colors.accentTerracotta },
  statusOk: { color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.primary },
  disabled: { opacity: 0.7 },
  primaryText: { ...typography.bodyBold, color: colors.textOnPrimary },
  secondary: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(47,82,51,0.35)', backgroundColor: colors.surface },
});
