import { Pause, Play } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { KomuzTrack } from '@/features/culture/audioData';
import { registerKomuzHost, useKomuzPlayerStore } from '@/features/culture/komuz/listening/useKomuzPlayerStore';
import { colors, radii, spacing, typography } from '@/theme';

type KomuzPlaylistProps = {
  tracks: KomuzTrack[];
};

export function KomuzPlaylist({ tracks }: KomuzPlaylistProps) {
  const { t } = useTranslation();
  // The ONE shared komuz session (Listening Room, lesson, culture items):
  // never two melodies, and never a melody over the Audio Guide.
  const currentTrackId = useKomuzPlayerStore((state) => state.currentTrackId);
  const playing = useKomuzPlayerStore((state) => state.playing);
  const queue = tracks.map((track) => track.id);
  useEffect(() => registerKomuzHost(), []);

  const handlePressTrack = (index: number) => {
    const store = useKomuzPlayerStore.getState();
    if (tracks[index].id === currentTrackId) store.toggle();
    else store.play(tracks[index].id, queue);
  };

  return (
    <View style={styles.list}>
      {tracks.map((track, index) => {
        const isActive = track.id === currentTrackId;
        const isPlaying = isActive && playing;
        return (
          <AnimatedPressable
            key={track.id}
            style={[styles.row, isActive && styles.rowActive]}
            onPress={() => handlePressTrack(index)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={`${isPlaying ? t('komuzRoom.pause') : t('komuzRoom.play')} ${track.title}`}
          >
            <View style={[styles.iconWrap, isPlaying && styles.iconWrapPlaying]}>
              {isPlaying ? (
                <Pause size={16} color={colors.textOnPrimary} strokeWidth={2} fill={colors.textOnPrimary} />
              ) : (
                <Play size={16} color={colors.primary} strokeWidth={2} fill="none" />
              )}
            </View>
            <View style={styles.trackBody}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {track.title}
              </Text>
              {track.performer ? (
                <Text style={styles.trackMeta} numberOfLines={1}>
                  {track.performer}
                </Text>
              ) : null}
              {!track.titleConfirmed ? (
                <Text style={styles.unconfirmed}>{t('culture.item.titleUnconfirmed')}</Text>
              ) : null}
            </View>
            {isPlaying ? (
              <View style={styles.nowPlayingBadge}>
                <Text style={styles.nowPlayingText}>{t('culture.item.nowPlaying')}</Text>
              </View>
            ) : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowActive: {
    borderColor: colors.primary,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPlaying: {
    backgroundColor: colors.primary,
  },
  trackBody: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  trackMeta: {
    ...typography.small,
    color: colors.textSecondary,
  },
  unconfirmed: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  nowPlayingBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  nowPlayingText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
});
