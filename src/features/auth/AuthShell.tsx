import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OymoOrnament } from '@/components/patterns/OymoOrnament';
import { AnimatedPressable, MediaImage } from '@/components/ui';
import { openingImage } from '@/features/onboarding/data';
import { cardRadii, colors, editorial, spacing, textStyles } from '@/theme';

/**
 * The one auth layout (Sign in, Create account, reset, verification):
 *   top    ONE existing OYNO photograph (the opening mountain lake) with
 *          the wordmark - never behind a text field
 *   sheet  cream, rounded, all form content on a calm plain surface
 * No tab bar, no app chrome. Scrolls with the keyboard up so the primary
 * action is always reachable on small iPhones; safe-area aware.
 */
export function AuthShell({
  title,
  subtitle,
  hero = 'full',
  onPressBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: string | null;
  /** full = Sign in / Create account; compact = the smaller follow-up steps. */
  hero?: 'full' | 'compact';
  onPressBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = insets.top + (hero === 'full' ? Math.min(Math.round(height * 0.24), 210) : 112);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.hero, { height: heroHeight }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MediaImage source={openingImage} position="center" />
          <LinearGradient colors={['rgba(19,32,24,0.45)', 'rgba(19,32,24,0.05)', 'rgba(19,32,24,0.55)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.brand, { bottom: spacing.xl + 4 }]}>
            <OymoOrnament size={14} color={colors.accentGold} strokeWidth={1.75} />
            <Text style={styles.wordmark}>OYNO</Text>
          </View>
        </View>
        {onPressBack ? (
          <AnimatedPressable style={[styles.back, { top: insets.top + spacing.xs }]} onPress={onPressBack} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('common.back')}>
            <ChevronLeft size={22} color={colors.textOnDark} strokeWidth={2.25} />
          </AnimatedPressable>
        ) : null}

        <View style={styles.sheet}>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A calm message next to the action it belongs to (not a red alert box).
 * Announced to screen readers when it appears. */
export function FormMessage({ tone, message }: { tone: 'error' | 'success' | 'info'; message: string | null | undefined }) {
  if (!message) return null;
  const Icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : CircleAlert;
  const color = tone === 'error' ? colors.error : tone === 'success' ? colors.success : colors.textSecondary;
  return (
    <View style={[styles.message, tone === 'error' && styles.messageError]} accessibilityLiveRegion="polite" accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Icon size={16} color={color} strokeWidth={2.25} />
      <Text style={[styles.messageText, { color: tone === 'info' ? colors.textSecondary : color }]}>{message}</Text>
    </View>
  );
}

/** "or" separator before social sign-in. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  hero: { overflow: 'hidden', backgroundColor: colors.surfaceFeature },
  brand: { position: 'absolute', left: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wordmark: { ...editorial(textStyles.title), fontSize: 22, letterSpacing: 4, color: colors.textOnDark },
  back: { position: 'absolute', left: spacing.md, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19,32,24,0.45)' },
  sheet: { flexGrow: 1, marginTop: -cardRadii.hero, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md, borderTopLeftRadius: cardRadii.hero, borderTopRightRadius: cardRadii.hero, backgroundColor: colors.background },
  heading: { gap: 6, marginBottom: spacing.xxs },
  title: { ...editorial(textStyles.h1), color: colors.textPrimary },
  subtitle: { ...textStyles.body, color: colors.textSecondary },
  footer: { marginTop: 'auto', paddingTop: spacing.md, gap: spacing.sm, alignItems: 'center' },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingVertical: spacing.xs },
  messageError: { paddingHorizontal: spacing.sm, borderRadius: cardRadii.chip, backgroundColor: 'rgba(184,92,56,0.08)' },
  messageText: { ...textStyles.caption, flex: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { ...textStyles.small, color: colors.textMuted },
});
