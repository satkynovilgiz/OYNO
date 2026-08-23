import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConfirmationModal } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import { SettingsRow } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

type DataSettingsScreenProps = {
  onClearCache: () => Promise<void>;
  onPressBack: () => void;
};

/** Spec Section 54's "Кэш / Data" - scoped narrowly and honestly: clears
 * notification read-state and preference settings (both safely
 * regenerable), not the account/session. A real "clear image cache" isn't
 * meaningful here since this app doesn't run its own image cache beyond
 * what Expo/RN Image already manages. */
export function DataSettingsScreen({ onClearCache, onPressBack }: DataSettingsScreenProps) {
  const { t } = useTranslation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleConfirm = async () => {
    setIsClearing(true);
    await onClearCache();
    setIsClearing(false);
    setConfirmVisible(false);
    setCleared(true);
  };

  return (
    <SettingsScreenLayout title={t('settings.data.title')} onPressBack={onPressBack}>
      <Text style={styles.description}>{t('settings.data.description')}</Text>

      <View style={styles.group}>
        <SettingsRow
          icon={Trash2}
          label={t('settings.data.clearCache')}
          destructive
          showChevron={false}
          onPress={() => setConfirmVisible(true)}
        />
      </View>

      {cleared ? <Text style={styles.saved}>{t('settings.data.cleared')}</Text> : null}

      <ConfirmationModal
        visible={confirmVisible}
        title={t('settings.data.modalTitle')}
        message={t('settings.data.modalMessage')}
        confirmLabel={t('settings.data.confirm')}
        cancelLabel={t('settings.data.cancel')}
        destructive
        isConfirming={isClearing}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmVisible(false)}
      />
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  group: {
    gap: spacing.xs,
  },
  saved: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
});
