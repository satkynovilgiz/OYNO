import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
    <SettingsScreenLayout title="Кэш / Дайындар" onPressBack={onPressBack}>
      <Text style={styles.description}>
        Бул жерден билдирүүлөрдүн окулган абалын жана жөндөөлөрдү баштапкы абалга келтирсеңиз болот.
        Аккаунтуңуз жана прогрессиңиз өзгөрбөйт.
      </Text>

      <View style={styles.group}>
        <SettingsRow icon={Trash2} label="Кэшти тазалоо" destructive showChevron={false} onPress={() => setConfirmVisible(true)} />
      </View>

      {cleared ? <Text style={styles.saved}>Тазаланды ✓</Text> : null}

      <ConfirmationModal
        visible={confirmVisible}
        title="Кэшти тазалоо"
        message="Билдирүүлөрдүн окулган абалы жана жөндөөлөр баштапкы абалга келет. Улантасызбы?"
        confirmLabel="Тазалоо"
        cancelLabel="Жок"
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
