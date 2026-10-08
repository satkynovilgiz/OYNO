import { Platform, StyleSheet, Text, View } from 'react-native';

import { OymoArtwork } from '../components/OymoArtwork';
import { backgroundColor, cleanGreeting, frameFor, GREETING_PADDING, greetingFontSize, greetingStyle, greetingTextBox, lineHeightFor, type PostcardComposition } from './postcardModel';

/**
 * The postcard at its LOGICAL size (360 x 450 or 360 x 360). The screen's
 * preview, the share preview and the exported image all render this same
 * component at this size (the export is captured at 3x), so what is
 * previewed is what is exported. Contents: the copied pattern, the chosen
 * background and the greeting - nothing else.
 */
export function PostcardView({ composition }: { composition: PostcardComposition }) {
  const frame = frameFor(composition);
  const background = backgroundColor(composition);
  const greeting = cleanGreeting(composition.greeting);
  const art = composition.artwork;
  const fontSize = frame.greeting ? greetingFontSize(greeting, greetingTextBox(frame.greeting)) : 0;
  const ink = greetingStyle(background);
  return (
    <View style={[styles.card, { width: frame.card.width, height: frame.card.height, backgroundColor: background }]} testID="postcard-card">
      {composition.layout === 'banner' ? <View style={[styles.band, { height: frame.pattern.y + frame.pattern.height + (frame.greeting ? 12 : 24), backgroundColor: art.backgroundColor }]} /> : null}
      {frame.strips.map((strip, index) => (
        <View key={index} style={[styles.strip, { left: strip.x, top: strip.y, width: strip.width, height: strip.height, backgroundColor: art.backgroundColor }]}>
          {Array.from({ length: Math.ceil(strip.width / strip.height) }, (_, tile) => (
            <OymoArtwork key={tile} layers={art.layers} backgroundColor={art.backgroundColor} symmetryMode={art.symmetryMode} size={strip.height} transparent />
          ))}
        </View>
      ))}
      {composition.layout !== 'border' || !frame.greeting ? (
        <View style={[styles.pattern, { left: frame.pattern.x, top: frame.pattern.y, borderRadius: composition.layout === 'classic' ? 12 : 0 }]} testID="postcard-pattern">
          <OymoArtwork layers={art.layers} backgroundColor={art.backgroundColor} symmetryMode={art.symmetryMode} size={frame.pattern.width} transparent={composition.layout === 'banner'} />
        </View>
      ) : null}
      {frame.greeting ? (
        <View style={[styles.greetingBox, { left: frame.greeting.x, top: frame.greeting.y, width: frame.greeting.width, height: frame.greeting.height }, ink.plate ? { backgroundColor: ink.plate, borderRadius: 12 } : null]} testID="postcard-greeting-box">
          <Text style={[styles.greeting, { fontSize, lineHeight: lineHeightFor(fontSize), color: ink.color }]} testID="postcard-greeting" {...{ dataSet: { fontSize: String(fontSize) } }}>
            {greeting}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, top: 0 },
  strip: { position: 'absolute', flexDirection: 'row', overflow: 'hidden' },
  pattern: { position: 'absolute', overflow: 'hidden' },
  // The box clips as a last resort only; sizes are chosen so the text fits (postcard.test.ts).
  greetingBox: { position: 'absolute', justifyContent: 'center', overflow: 'hidden', padding: GREETING_PADDING },
  greeting: { textAlign: 'center', fontWeight: '700', ...(Platform.OS === 'web' ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as object) : null) },
});
