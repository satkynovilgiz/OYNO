import { ImageOff } from 'lucide-react-native';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, editorial } from '@/theme';

import type { CollageItem, CollageLayout } from './collageModel';

/** Base frame (portrait); the share card scales it into its 1080x1350 image. */
export const COLLAGE_FRAME = { width: 900, height: 1080 };

type Props = {
  items: CollageItem[];
  layout: CollageLayout;
  caption: string;
  /** Rendered width; everything scales from the 900-wide frame. */
  width: number;
  formatDate: (memoryDate: string) => string;
  unavailableLabel: string;
  editorial?: boolean;
};

/**
 * The collage itself - used for the on-screen preview AND as the share
 * card artwork, so what is previewed is exactly what is shared. Only the
 * person's own Journal photos; text memories are paper cards; a photo whose
 * file isn't on this device shows an honest "unavailable" tile.
 */
export function CollageView({ items, layout, caption, width, formatDate, unavailableLabel, editorial = false }: Props) {
  const s = width / COLLAGE_FRAME.width;
  const pad = 36 * s;
  const gap = 20 * s;
  const captionHeight = caption ? 90 * s : 0;
  const inner = { width: width - pad * 2, height: COLLAGE_FRAME.height * s - pad * 2 - captionHeight };

  let tiles: { item: CollageItem; style: object; rotate: number }[] = [];
  if (layout === 'story') {
    const rowHeight = (inner.height - gap * (items.length - 1)) / items.length;
    tiles = items.map((item, index) => ({ item, rotate: 0, style: { position: 'absolute', left: 0, top: index * (rowHeight + gap), width: inner.width, height: rowHeight } }));
  } else {
    const columns = items.length <= 2 ? 1 : 2;
    const rows = Math.ceil(items.length / columns);
    const tileWidth = (inner.width - gap * (columns - 1)) / columns;
    const tileHeight = (inner.height - gap * (rows - 1)) / rows;
    tiles = items.map((item, index) => ({
      item,
      rotate: layout === 'scrapbook' ? (index % 2 === 0 ? -2.5 : 2) : 0,
      style: { position: 'absolute', left: (index % columns) * (tileWidth + gap), top: Math.floor(index / columns) * (tileHeight + gap), width: tileWidth, height: tileHeight },
    }));
  }

  return (
    <View style={[styles.frame, layout === 'scrapbook' && styles.frameScrapbook, { width, height: COLLAGE_FRAME.height * s, padding: pad }]}>
      {caption ? (
        <Text style={[styles.caption, editorial && styles.captionEditorial, { fontSize: 44 * s, lineHeight: 56 * s, marginBottom: 30 * s }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      <View style={{ width: inner.width, height: inner.height }}>
        {tiles.map(({ item, style, rotate }) => (
          <View key={item.id} style={[style, { transform: [{ rotate: `${rotate}deg` }] }]}>
            <Tile item={item} story={layout === 'story'} s={s} formatDate={formatDate} unavailableLabel={unavailableLabel} scrapbook={layout === 'scrapbook'} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Tile({ item, story, s, formatDate, unavailableLabel, scrapbook }: { item: CollageItem; story: boolean; s: number; formatDate: (date: string) => string; unavailableLabel: string; scrapbook: boolean }) {
  const [failed, setFailed] = useState(false);
  const state = item.photoState === 'photo' && failed ? 'missing' : item.photoState;
  const text = (
    <View style={[styles.text, { padding: 16 * s, gap: 6 * s }]}>
      <Text style={[styles.date, { fontSize: 22 * s }]}>{formatDate(item.memoryDate)}</Text>
      <Text style={[styles.title, { fontSize: 30 * s, lineHeight: 38 * s }]} numberOfLines={2}>
        {item.title}
      </Text>
      {item.excerpt ? (
        <Text style={[styles.excerpt, { fontSize: 22 * s, lineHeight: 30 * s }]} numberOfLines={3}>
          {item.excerpt}
        </Text>
      ) : null}
      {item.linkLabel ? (
        <Text style={[styles.link, { fontSize: 20 * s }]} numberOfLines={1}>
          {item.linkLabel}
        </Text>
      ) : null}
    </View>
  );
  const visual =
    state === 'photo' ? (
      <Image source={{ uri: item.photoUri! }} style={styles.photo} resizeMode="cover" onError={() => setFailed(true)} />
    ) : state === 'missing' ? (
      <View style={[styles.photo, styles.missing, { gap: 8 * s }]}>
        <ImageOff size={40 * s} color={colors.textMuted} strokeWidth={1.75} />
        <Text style={[styles.missingText, { fontSize: 20 * s }]}>{unavailableLabel}</Text>
      </View>
    ) : null;

  return (
    <View style={[styles.tile, scrapbook && styles.tileScrapbook, state === 'none' && styles.paper, { borderRadius: 24 * s, flexDirection: story ? 'row' : 'column' }]}>
      {visual ? <View style={story ? { width: '45%' } : { flex: 1 }}>{visual}</View> : null}
      <View style={story || !visual ? { flex: 1, justifyContent: visual ? 'center' : 'flex-start' } : undefined}>{text}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.background, overflow: 'hidden' },
  frameScrapbook: { backgroundColor: colors.surfaceAlt },
  caption: { fontWeight: '800', color: colors.textPrimary },
  captionEditorial: editorial({ fontWeight: '700' as const }),
  tile: { flex: 1, overflow: 'hidden', backgroundColor: colors.surfaceElevated },
  tileScrapbook: { borderWidth: 6, borderColor: '#FFFFFF' },
  paper: { backgroundColor: colors.surfaceAlt },
  photo: { width: '100%', height: '100%' },
  missing: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  missingText: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 8 },
  text: {},
  date: { fontWeight: '700', color: colors.accentTerracotta },
  title: { fontWeight: '800', color: colors.textPrimary },
  excerpt: { color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: '600' },
});
