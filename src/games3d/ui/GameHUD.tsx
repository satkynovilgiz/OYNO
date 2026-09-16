import { Clock, Pause } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { colors, radii, spacing, typography } from '@/theme';

/** Shared by `ui/PracticeBar.tsx` so its own top offset stays in sync with
 * however tall this bar actually is, instead of a second, independently-
 * guessed magic number. */
export const GAME_HUD_HEIGHT = 44;

type GameHUDProps = {
  title: string;
  onPause: () => void;
  /** Left-aligned stat, e.g. score. */
  primaryStat?: { label: string; value: string };
  /** Right-aligned stat, e.g. arrows remaining, time left, or the
   * opponent's score - when both are present they render as one two-up
   * scoreboard card (a thin divider between them) rather than two
   * separate pills, which reads as "player vs. AI" at a glance for the
   * games that pass a real opposing score (Ordo/Chuko/Kok Boru). */
  secondaryStat?: { label: string; value: string };
  /** A match/round clock (Section "Timer") - kept as its own small chip
   * with a clock glyph instead of a third generic label/value pair, so
   * "how much time is left" always looks the same across every game that
   * has one (Kyz Kuumai's elapsed chase time, Kok Boru's match countdown)
   * and never has to compete with `primaryStat`/`secondaryStat` for a slot
   * (Kok Boru needs both a you-vs-AI scoreboard AND a timer visible at
   * once). No label text - the clock glyph already says what this number
   * is, which keeps it compact. */
  timerValue?: string;
  /** Shows a small "Practice" tag next to the title (Section "Practice
   * mode label") - omit/`false` for a normal match. */
  practice?: boolean;
};

/** Minimal shared HUD chrome (Section 20): back/pause top-left, title
 * centered, one or two compact stat pills - never a large card over the 3D
 * scene. Respects safe areas for landscape play (Section 91).
 *
 * Visual language (Section "Polish the HUD design"): every chip is a warm,
 * translucent dark-brown card (not flat black) with a thin gold-tinted
 * border, matching `ui/StatusBanner.tsx`'s "neutral" tone so every piece of
 * game chrome reads as one consistent system - never a generic gray/black
 * gaming overlay. Numbers are the visual anchor of each stat (bold, gold),
 * labels are a small muted caption above them, and every chip stays a
 * separate, compact, rounded shape with gaps between them rather than one
 * wide bar - that both keeps more of the 3D scene visible and keeps this
 * informational HUD visually distinct from the bottom movement controls
 * (joystick/sprint/context-action), which intentionally keep their own
 * plain gold/neutral look untouched. */
export function GameHUD({ title, onPause, primaryStat, secondaryStat, timerValue, practice }: GameHUDProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingTop: insets.top + spacing.xs, paddingHorizontal: insets.left + spacing.sm }]}
    >
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          onPress={onPause}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="pause"
          style={styles.pauseButton}
        >
          <Pause size={18} color={colors.accentGold} strokeWidth={2.25} />
        </Pressable>

        <View style={styles.titleChip}>
          <OymoOrnament size={10} color={colors.accentGold} strokeWidth={1.5} />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {practice ? (
            <View style={styles.practiceTag}>
              <Text style={styles.practiceTagText}>{t('games3d.hud.practice')}</Text>
            </View>
          ) : null}
        </View>

        {primaryStat ? (
          <View style={styles.statsCard}>
            <StatColumn label={primaryStat.label} value={primaryStat.value} />
            {secondaryStat ? (
              <>
                <View style={styles.statDivider} />
                <StatColumn label={secondaryStat.label} value={secondaryStat.value} emphasis={false} />
              </>
            ) : null}
          </View>
        ) : null}

        {timerValue ? (
          <View style={styles.timerChip}>
            <Clock size={12} color={colors.accentGold} strokeWidth={2.5} />
            <Text style={styles.timerValue} numberOfLines={1}>
              {timerValue}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** `emphasis` (default true) puts the value in gold, the HUD's "this is
 * the important number" color - the second column of a you-vs-AI pairing
 * (Ordo/Chuko/Kok Boru's opponent score) renders in a calmer cream tone
 * instead, a subtle hierarchy cue ("yours" stands out) rather than a
 * competing red/blue team-color scheme, which would read as more generic
 * sports-game UI than OYNO's own warm palette. */
function StatColumn({ label, value, emphasis = true }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, !emphasis && styles.statValueMuted]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const CARD_BACKGROUND = 'rgba(43,32,25,0.72)';
const CARD_BORDER = 'rgba(232,185,61,0.3)';

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: GAME_HUD_HEIGHT,
  },
  pauseButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    height: 36,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textOnDark,
    flexShrink: 1,
  },
  practiceTag: {
    borderWidth: 1,
    borderColor: colors.accentGold,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 1,
  },
  practiceTagText: {
    ...typography.small,
    fontSize: 9,
    color: colors.accentGold,
    letterSpacing: 0.5,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radii.md,
    height: 36,
  },
  statColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    minWidth: 44,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: CARD_BORDER,
    marginVertical: 6,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  statValue: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.accentGold,
    lineHeight: 17,
  },
  statValueMuted: {
    color: colors.textOnDark,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    height: 36,
  },
  timerValue: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.accentGold,
  },
});
