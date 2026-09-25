import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui';
import { colors, spacing } from '@/theme';

/**
 * Any unmatched route - an old/invalid deep link from a widget, a
 * notification or a shared link - lands here instead of expo-router's
 * developer "Unmatched Route" page: one calm line and a way home.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom }]}>
      <EmptyState icon={Compass} title={t('common.notFound')} actionLabel={t('home.nav.home')} onPressAction={() => router.replace('/home')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
});
