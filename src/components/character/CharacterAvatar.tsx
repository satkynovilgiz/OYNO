import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, typography } from '@/theme';

import { getCharacterEmotionAsset, type CharacterEmotion, type CharacterId } from './characterAssets';

type CharacterAvatarProps = {
  characterId: CharacterId;
  emotion: CharacterEmotion;
  size?: number;
};

/** Renders a character's emotion portrait, or an initial-letter placeholder
 * for characters that don't have a sliced sheet yet. */
export function CharacterAvatar({ characterId, emotion, size = 96 }: CharacterAvatarProps) {
  const { t } = useTranslation();
  const asset = getCharacterEmotionAsset(characterId, emotion);
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!asset) {
    return (
      <View style={[styles.placeholder, dimensionStyle]}>
        <Text style={[styles.placeholderLetter, { fontSize: size * 0.4 }]}>
          {t(`character.names.${characterId}`).charAt(0)}
        </Text>
      </View>
    );
  }

  return <Image source={asset} style={[styles.image, dimensionStyle]} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderLetter: {
    ...typography.display,
    color: colors.textMuted,
    borderRadius: radii.pill,
  },
});
