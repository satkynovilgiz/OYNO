import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import type { KomuzTrack } from '@/features/culture/audioData';
import { colors, radii, spacing, typography } from '@/theme';

type KomuzPlaylistProps = {
  tracks: KomuzTrack[];
};

export function KomuzPlaylist({ tracks }: KomuzPlaylistProps) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const player = useAudioPlayer(tracks[activeIndex]?.source);
  const status = useAudioPlayerStatus(player);

  const handlePressTrack = (index: number) => {
    if (index === activeIndex) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }
    setActiveIndex(index);
    player.replace(tracks[index].source);
    player.play();
  };

  return (
    <View style={styles.list}>
      {tracks.map((track, index) => {
        const isActive = index === activeIndex;
        const isPlaying = isActive && status.playing;
        return (
          <AnimatedPressable
            key={track.id}
            style={[styles.row, isActive && styles.rowActive]}
            onPress={() => handlePressTrack(index)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={track.title}
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
