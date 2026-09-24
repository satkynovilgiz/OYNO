import { Clock, Pause } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { radii, spacing, typography } from '@/theme';

import { HUD, useHudScale } from './hudTheme';

/** Shared by `ui/PracticeBar.tsx` so its own top offset stays in sync with
 * however tall this bar actually is, instead of a second, independently-
 * guessed magic number. */
export const GAME_HUD_HEIGHT = 52;

type GameHUDProps = {
  title: string;
  onPause: () => void;
  /** Left stat, e.g. score. */
  primaryStat?: { label: string; value: string };
  /** Right stat, e.g. arrows remaining or the opponent's score - rendered
   * with `primaryStat` as one two-up scoreboard ("you vs. them"). */
  secondaryStat?: { label: string; value: string };
  /** A match/round clock - its own small chip with a clock glyph. */
  timerValue?: string;
  /** Small "Practice" tag next to the title. */
  practice?: boolean;
};

/**
 * The shared top HUD for every 3D game: pause (a real 44+ pt target),
 * the game title, and ONLY the stats the game actually passes - nothing
 * else over the scene. Deep-forest translucent chips with cream text and
 * gold numbers (hudTheme). Pads for every safe-area edge, so in landscape
 * nothing sits under the notch / Dynamic Island.
 *
 * Performance: memoized - it re-renders only when a shown value changes
 * (games pass primitive strings), never per 3D frame. Numbers use tabular
 * digits so a ticking timer doesn't jitter the layout.
 */
export const GameHUD = memo(function GameHUD({ title, onPause, primaryStat, secondaryStat, timerValue, practice }: GameHUDProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scale = useHudScale();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingTop: insets.top + spacing.xs, paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm }]}
    >
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          onPress={onPause}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('games3d.pause.button')}
          style={({ pressed }) => [styles.pauseButton, { width: scale.button, height: scale.button, borderRadius: scale.button / 2 }, pressed && styles.pressed]}
        >
          <Pause size={scale.button * 0.42} color={HUD.gold} fill={HUD.gold} strokeWidth={0} />
        </Pressable>

        {scale.showTitle ? (
          <View style={styles.titleChip}>
            {scale.ornament ? <OymoOrnament size={10} color={HUD.gold} strokeWidth={1.5} /> : null}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {practice ? (
              <View style={styles.practiceTag}>
                <Text style={styles.practiceTagText}>{t('games3d.hud.practice')}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.spacer} pointerEvents="none">
            {practice ? (
              <View style={[styles.practiceTag, styles.practiceTagFloating]}>
                <Text style={styles.practiceTagText}>{t('games3d.hud.practice')}</Text>
              </View>
            ) : null}
          </View>
        )}

        {primaryStat ? (
          <View
            style={styles.statsCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={[primaryStat, secondaryStat].filter(Boolean).map((stat) => `${stat!.label} ${stat!.value}`).join(', ')}
          >
            <StatColumn label={primaryStat.label} value={primaryStat.value} size={scale.value} />
            {secondaryStat ? (
              <>
                <View style={styles.statDivider} />
                <StatColumn label={secondaryStat.label} value={secondaryStat.value} size={scale.value} emphasis={false} />
              </>
            ) : null}
          </View>
        ) : null}

        {timerValue ? (
          <View style={styles.timerChip} accessible accessibilityRole="text" accessibilityLabel={`${t('games3d.hud.time')} ${timerValue}`}>
            <Clock size={13} color={HUD.gold} strokeWidth={2.5} />
            <Text style={[styles.timerValue, { fontSize: scale.value }]} numberOfLines={1}>
              {timerValue}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

/** Your number in gold, the opponent's in cream - a quiet hierarchy cue,
 * readable without relying on colour alone (each has its own label). */
function StatColumn({ label, value, size, emphasis = true }: { label: string; value: string; size: number; emphasis?: boolean }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { fontSize: size, lineHeight: size + 3 }, !emphasis && styles.statValueMuted]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: GAME_HUD_HEIGHT },
  pauseButton: { backgroundColor: HUD.surface, borderWidth: 1, borderColor: HUD.border, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.92 }], backgroundColor: HUD.surfaceStrong },
  titleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, backgroundColor: HUD.surface, borderWidth: 1, borderColor: HUD.border, borderRadius: radii.pill, paddingHorizontal: spacing.sm, height: 38 },
  spacer: { flex: 1, alignItems: 'flex-start' },
  title: { ...typography.caption, fontWeight: '700', color: HUD.text, flexShrink: 1 },
  practiceTag: { borderWidth: 1, borderColor: HUD.gold, borderRadius: radii.sm, paddingHorizontal: spacing.xxs, paddingVertical: 1 },
  practiceTagFloating: { backgroundColor: HUD.surface },
  practiceTagText: { ...typography.small, fontSize: 10, fontWeight: '700', color: HUD.gold, letterSpacing: 0.5 },
  statsCard: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: HUD.surface, borderWidth: 1, borderColor: HUD.border, borderRadius: radii.lg, minHeight: 38 },
  statColumn: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm, minWidth: 48 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: HUD.border, marginVertical: 6 },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: HUD.textMuted },
  statValue: { fontWeight: '800', color: HUD.gold, fontVariant: ['tabular-nums'] },
  statValueMuted: { color: HUD.text },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: HUD.surface, borderWidth: 1, borderColor: HUD.border, borderRadius: radii.pill, paddingHorizontal: spacing.sm, height: 38 },
  timerValue: { fontWeight: '800', color: HUD.gold, fontVariant: ['tabular-nums'] },
});
