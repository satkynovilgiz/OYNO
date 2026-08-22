import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconChip } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

const RESEND_COOLDOWN_SECONDS = 30;

type CheckEmailScreenProps = {
  title: string;
  email: string;
  error: string | null;
  onResend: () => Promise<boolean>;
  links: { label: string; onPress: () => void }[];
};

/** Shown after signUp() or requestPasswordReset() - both now deliver a
 * magic link rather than a typed code (see SupabaseAuthService's doc
 * comment for why), so this screen's only job is "check your email,
 * here's how to get another one if it didn't arrive." Tapping the actual
 * link opens the app via a deep-link route (auth-callback-signup /
 * auth-callback-recovery), not anything on this screen. */
export function CheckEmailScreen({ title, email, error, onResend, links }: CheckEmailScreenProps) {
  const insets = useSafeAreaInsets();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [resendConfirmed, setResendConfirmed] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setResendConfirmed(false);
    const ok = await onResend();
    setIsResending(false);
    if (ok) {
      setResendConfirmed(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <IconChip icon={Mail} size={56} iconSize={26} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{email} дарегине шилтеме жөнөттүк. Почтаңызды текшерип, шилтемени басыңыз.</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {resendConfirmed && !error ? <Text style={styles.confirmedText}>Шилтеме кайра жөнөтүлдү.</Text> : null}

        <Text style={[styles.resendLink, (cooldown > 0 || isResending) && styles.resendLinkDisabled]} onPress={handleResend}>
          {cooldown > 0 ? `Кайра жөнөтүү (${cooldown}с)` : 'Шилтемени кайра жөнөтүү'}
        </Text>
      </View>

      <View style={styles.linksRow}>
        {links.map((link) => (
          <Text key={link.label} style={styles.linkText} onPress={link.onPress}>
            {link.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  content: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  confirmedText: {
    ...typography.small,
    color: colors.primary,
  },
  resendLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    overflow: 'hidden',
  },
  resendLinkDisabled: {
    color: colors.textMuted,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
