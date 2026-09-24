import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { fontFamily, radii, spacing } from '@/theme';

import { HudButton } from './HudButton';
import { HUD } from './hudTheme';

type PauseMenuProps = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  /** Optional so a game without a re-playable how-to-play flow never
   * shows a dead button. */
  onHowToPlay?: () => void;
  /** Shown under "Paused" so the player remembers which game this is. */
  gameTitle?: string;
};

/**
 * Shared OYNO pause sheet for every 3D game - not a system alert: a deep
 * forest card over a soft scrim, Resume as the one gold primary action,
 * How to Play / Restart as secondary, Exit as a quiet last option. Centered
 * and height-safe, so it works in landscape as well as portrait.
 */
export function PauseMenu({ visible, onResume, onRestart, onExit, onHowToPlay, gameTitle }: PauseMenuProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onResume} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.backdrop, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, paddingLeft: insets.left + spacing.md, paddingRight: insets.right + spacing.md }]}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <OymoOrnament size={18} color={HUD.gold} strokeWidth={1.5} />
            <Text style={styles.title} accessibilityRole="header">
              {t('games3d.pause.title')}
            </Text>
            {gameTitle ? <Text style={styles.subtitle}>{gameTitle}</Text> : null}
            <View style={styles.actions}>
              <HudButton label={t('games3d.pause.resume')} variant="primary" onPress={onResume} />
              {onHowToPlay ? <HudButton label={t('games3d.pause.howToPlay')} onPress={onHowToPlay} /> : null}
              <HudButton label={t('games3d.pause.restart')} onPress={onRestart} />
              <HudButton label={t('games3d.pause.exit')} variant="quiet" onPress={onExit} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: HUD.scrim, alignItems: 'center', justifyContent: 'center' },
  sheet: { width: 340, maxWidth: '100%', maxHeight: '100%', backgroundColor: HUD.surfaceStrong, borderRadius: radii.xxl, borderWidth: 1, borderColor: HUD.border },
  content: { padding: spacing.lg, gap: spacing.xs, alignItems: 'center' },
  title: { fontFamily: fontFamily.wordmark, fontSize: 26, fontWeight: '700', color: HUD.text },
  subtitle: { fontSize: 13, fontWeight: '600', color: HUD.textMuted, marginBottom: spacing.xs },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
});
