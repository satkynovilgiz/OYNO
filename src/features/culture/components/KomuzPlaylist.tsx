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
            accessibilityRole="button"
            accessibilityLabel={track.title}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              {isPlaying ? (
                <Pause size={16} color={colors.textOnPrimary} strokeWidth={2} fill={colors.textOnPrimary} />
              ) : (
                <Play
                  size={16}
                  color={isActive ? colors.textOnPrimary : colors.primary}
                  strokeWidth={2}
                  fill={isActive ? colors.textOnPrimary : 'none'}
                />
              )}
            </View>
            <View style={styles.trackBody}>
              <Text style={[styles.trackTitle, isActive && styles.textOnActive]} numberOfLines={1}>
                {track.title}
              </Text>
              {track.performer ? (
                <Text style={[styles.trackMeta, isActive && styles.textOnActive]} numberOfLines={1}>
                  {track.performer}
                </Text>
              ) : null}
              {!track.titleConfirmed ? (
                <Text style={[styles.unconfirmed, isActive && styles.textOnActive]}>
                  {t('culture.item.titleUnconfirmed')}
                </Text>
              ) : null}
            </View>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowActive: {
    backgroundColor: colors.primary,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  textOnActive: {
    color: colors.textOnPrimary,
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
});
