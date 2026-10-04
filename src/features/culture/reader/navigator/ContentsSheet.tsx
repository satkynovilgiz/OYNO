import { List, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, Button, IconButton } from '@/components/ui';
import { useReducedMotion } from '@/services/motion/useReducedMotion';
import { colors, radii, spacing, textStyles, typography } from '@/theme';

import { sectionA11yLabel, type NavSection } from './sectionNavigator';

/**
 * "Contents" next to the Reader (Aa) control. Lists the article's rendered
 * section headings in order, marks "You are here", and jumps on tap.
 * Derived entirely from the loaded article - no network.
 */
export function ContentsButton({ sections, current, onJump, elevated }: { sections: readonly NavSection[]; current: string | null; onJump: (key: string) => void; elevated?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={List} size={40} iconSize={19} shape="roundedSquare" elevated={elevated} accessibilityLabel={t('readerNavigator.contents')} onPress={() => setOpen(true)} />
      {open ? (
        <ContentsSheet
          sections={sections}
          current={current}
          onClose={() => setOpen(false)}
          onJump={(key) => {
            setOpen(false);
            onJump(key);
          }}
        />
      ) : null}
    </>
  );
}

export function ContentsSheet({ sections, current, onJump, onClose }: { sections: readonly NavSection[]; current: string | null; onJump: (key: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const words = { sectionOf: (position: number, total: number) => t('readerNavigator.sectionOf', { position, total }), youAreHere: t('readerNavigator.youAreHere') };
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {t('readerNavigator.contents')}
        </Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sections.map((section, index) => {
            const here = section.key === current;
            return (
              <AnimatedPressable
                key={section.key}
                style={[styles.row, here && styles.rowHere]}
                onPress={() => onJump(section.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: here }}
                accessibilityLabel={sectionA11yLabel(section, index + 1, sections.length, here, words)}
              >
                <Text style={styles.number}>{index + 1}</Text>
                <Text style={[styles.label, here && styles.labelHere]} numberOfLines={2}>
                  {section.label}
                </Text>
                {here ? (
                  <View style={styles.here}>
                    <MapPin size={12} color={colors.primary} strokeWidth={2.5} />
                    <Text style={styles.hereText}>{t('readerNavigator.youAreHere')}</Text>
                  </View>
                ) : null}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,18,0.45)' },
  sheet: { gap: spacing.sm, padding: spacing.md, maxHeight: '80%', borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.background },
  title: { ...typography.h2, color: colors.textPrimary },
  list: { flexGrow: 0 },
  listContent: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radii.md },
  rowHere: { backgroundColor: colors.surfaceElevated },
  number: { ...textStyles.small, width: 20, color: colors.textMuted, fontWeight: '700' },
  label: { ...textStyles.body, flex: 1, color: colors.textPrimary },
  labelHere: { fontWeight: '700' },
  here: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hereText: { ...textStyles.small, color: colors.primary, fontWeight: '700' },
});
