import { Mountain } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';

type HeroBannerProps = {
  imageUri?: string;
};

/**
 * Static illustration slot (Boz Üy + grassland scene with the cast of
 * characters). Renders the real artwork once `imageUri` is supplied;
 * until then shows a sized placeholder so layout/spacing stays correct.
 */
export function HeroBanner({ imageUri }: HeroBannerProps) {
  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={styles.container} resizeMode="cover" />;
  }

  return (
    <View style={[styles.container, styles.placeholder]}>
      <Mountain size={32} color={colors.accentBrown} strokeWidth={1.5} />
      <Text style={styles.placeholderText}>Boz Üy illustration</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1.8,
    borderRadius: radii.xl,
    ...shadows.card,
  },
  placeholder: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
