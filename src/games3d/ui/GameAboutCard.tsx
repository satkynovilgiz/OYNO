import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { fontFamily, radii, spacing, typography } from '@/theme';

import { HudButton } from './HudButton';
import { HUD } from './hudTheme';

type GameAboutCardProps = {
  visible: boolean;
  title: string;
  description: string;
  objective: string;
  onDone: () => void;
};

/**
 * The lightweight start sheet shown before a first game: name, one short
 * description, the objective in one line, and Start. Not a wall of text -
 * the controls come next as 1-4 visual hints (TutorialOverlay). Same
 * deep-forest HUD language; safe-area aware in landscape and portrait.
 */
export function GameAboutCard({ visible, title, description, objective, onDone }: GameAboutCardProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, paddingLeft: insets.left + spacing.md, paddingRight: insets.right + spacing.md }]}
    >
      <View style={styles.card} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.titleRow}>
            <OymoOrnament size={14} color={HUD.gold} strokeWidth={1.6} />
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.objective}>
            <Text style={styles.objectiveLabel}>{t('games3d.about.objectiveLabel')}</Text>
            <Text style={styles.objectiveText}>{objective}</Text>
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <HudButton label={t('gameIntro.skip')} variant="quiet" onPress={onDone} />
          <View style={styles.primary}>
            <HudButton label={t('games3d.about.continue')} variant="primary" onPress={onDone} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: HUD.scrim },
  card: { width: '100%', maxWidth: 520, maxHeight: '100%', backgroundColor: HUD.surfaceStrong, borderRadius: radii.xxl, borderWidth: 1, borderColor: HUD.border, padding: spacing.lg, gap: spacing.md },
  content: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontFamily: fontFamily.wordmark, fontSize: 26, fontWeight: '700', color: HUD.text, flexShrink: 1 },
  description: { ...typography.body, color: HUD.textMuted },
  objective: { backgroundColor: 'rgba(232,185,61,0.12)', borderRadius: radii.lg, padding: spacing.sm, gap: 2 },
  objectiveLabel: { ...typography.overline, color: HUD.gold },
  objectiveText: { ...typography.bodyBold, color: HUD.text },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  primary: { flex: 1, maxWidth: 240 },
});
