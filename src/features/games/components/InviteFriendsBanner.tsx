import { Gift } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, IconChip } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type InviteFriendsBannerProps = {
  onPressInvite?: () => void;
};

export function InviteFriendsBanner({ onPressInvite }: InviteFriendsBannerProps) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <IconChip icon={Gift} size={48} iconSize={24} color={colors.accentGold} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t('games.invite.title')}</Text>
        <Text style={styles.subtitle}>{t('games.invite.subtitle')}</Text>
      </View>
      <Button label={t('games.invite.cta')} onPress={onPressInvite} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
