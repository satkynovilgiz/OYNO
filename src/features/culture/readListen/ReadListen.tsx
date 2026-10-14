import { Headphones } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { track } from '@/services/analytics/analytics';
import { useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';
import { colors, controlStates, radii, spacing, textStyles } from '@/theme';

import { activeSections, chunkSectionMap, narrationChunks, type NarrationPart } from './narrationSections';

/** The section(s) being read aloud now for this content (device speech only). */
export function useReadListen(contentKey: string, parts: readonly NarrationPart[]): { keys: string[]; recorded: boolean; active: boolean } {
  const { i18n } = useTranslation();
  const sessionKey = `${contentKey}:${i18n.language}`;
  const active = useAudioGuideStore((state) => state.sessionKey === sessionKey);
  const status = useAudioGuideStore((state) => state.status);
  const chunk = useAudioGuideStore((state) => state.chunk);
  const recorded = useAudioGuideStore((state) => state.canSeek);
  const map = useMemo(() => chunkSectionMap(parts, narrationChunks(parts)), [parts]);
  const keys = activeSections({ active, status, chunk, recorded }, map);
  return { keys, recorded: active && recorded, active };
}

/**
 * "Read & Listen" + "Follow narration" - two real switches with accessible
 * state. Shown only where narration exists for the text on screen.
 */
export function ReadListenControls({ enabled, onToggle, follow, onToggleFollow, recorded, showFollow = true }: { enabled: boolean; onToggle: (value: boolean) => void; follow: boolean; onToggleFollow: (value: boolean) => void; recorded: boolean; showFollow?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.box}>
      <AnimatedPressable
        style={styles.row}
        onPress={() => {
          if (!enabled) track('read_listen_started');
          onToggle(!enabled);
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        aria-checked={enabled}
        accessibilityLabel={t('readListen.mode')}
        accessibilityHint={t('readListen.modeHint')}
      >
        <Headphones size={16} color={colors.primary} strokeWidth={2.25} />
        <Text style={styles.label}>{t('readListen.mode')}</Text>
        <SwitchMark on={enabled} />
      </AnimatedPressable>
      {enabled ? (
        <>
          {showFollow ? <AnimatedPressable style={styles.row} onPress={() => onToggleFollow(!follow)} accessibilityRole="switch" accessibilityState={{ checked: follow }} aria-checked={follow} accessibilityLabel={t('readListen.follow')}>
            <Text style={[styles.label, styles.sub]}>{t('readListen.follow')}</Text>
            <SwitchMark on={follow} />
          </AnimatedPressable> : null}
          <Text style={styles.note}>{recorded ? t('readListen.recordedNote') : t('readListen.note')}</Text>
        </>
      ) : null}
    </View>
  );
}

/** Visual only: the row itself is the switch (a real Switch inside it would be a nested control - an unlabeled checkbox on web). */
function SwitchMark({ on }: { on: boolean }) {
  return (
    <View style={[styles.track, on && styles.trackOn]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

/** Audio "now reading" emphasis - deliberately different from a saved Highlight. */
export const readListenStyles = StyleSheet.create({
  current: { backgroundColor: colors.surfaceAlt, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.sm, marginLeft: -spacing.sm - 3, borderRadius: radii.sm },
});

const styles = StyleSheet.create({
  box: { gap: 2, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  label: { ...textStyles.bodyMedium, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  sub: { fontWeight: '500' },
  note: { ...textStyles.small, color: colors.textMuted },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: colors.surfaceBorder, justifyContent: 'center' },
  trackOn: { backgroundColor: controlStates.selected.bg },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface },
  knobOn: { alignSelf: 'flex-end' },
});
