import { requireOptionalNativeModule } from 'expo';
import { useRef, useState, type ReactNode } from 'react';
import { NativeModules, PixelRatio, Platform, Share, StyleSheet, TurboModuleRegistry, View } from 'react-native';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, ShareCard, type ShareCardContent } from '@/components/share/ShareCard';
import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';

/** Target export size - a 4:5 social post. */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;

const IMAGE_WAIT_MS = 3000;

/**
 * Image sharing needs two native modules (react-native-view-shot to render
 * the card, expo-sharing to hand the file to the OS share sheet). Both
 * resolve their native side at import time and THROW when it's missing -
 * which it is in any build installed before they were added, since an EAS
 * OTA update can't ship native code. So: check first, require lazily, and
 * fall back to the plain text share everywhere else (web included).
 */
function imageShareSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const viewShot = TurboModuleRegistry.get('RNViewShot') ?? NativeModules.RNViewShot;
    return !!viewShot && !!requireOptionalNativeModule('ExpoSharing');
  } catch {
    return false;
  }
}

async function shareText(message: string) {
  // Rejects on web without the Web Share API or when the user dismisses the
  // sheet - neither is an error worth surfacing (app-wide convention).
  await Share.share({ message }).catch(() => {});
}

/**
 * `share(content, fallbackMessage)` renders one ShareCard off-screen ONLY
 * at the moment the user presses Share, waits for its artwork to load,
 * captures it at 1080×1350, opens the native share sheet with the image,
 * then unmounts it - nothing is rendered or exported in the background.
 * Mount `shareHost` anywhere in the calling screen.
 */
export function useShareCard(): { share: (content: ShareCardContent, fallbackMessage: string) => Promise<void>; shareHost: ReactNode; isSharing: boolean } {
  const [content, setContent] = useState<ShareCardContent | null>(null);
  const cardRef = useRef<View>(null);
  const readyRef = useRef<(() => void) | null>(null);

  async function share(next: ShareCardContent, fallbackMessage: string) {
    if (content) return;
    if (!imageShareSupported()) {
      recordDiagnostic('native_unavailable', 'image_share');
      await shareText(fallbackMessage);
      return;
    }

    const ready = new Promise<void>((resolve) => {
      readyRef.current = resolve;
      setTimeout(resolve, IMAGE_WAIT_MS);
    });
    setContent(next);
    if (!next.imageSource) setTimeout(() => readyRef.current?.(), 50);

    try {
      await ready;
      // One extra frame so the loaded image is actually painted.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');

      const scale = PixelRatio.get();
      const uri = await captureRef(cardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        width: SHARE_IMAGE_WIDTH / scale,
        height: SHARE_IMAGE_HEIGHT / scale,
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: next.title });
    } catch {
      await shareText(fallbackMessage);
    } finally {
      readyRef.current = null;
      setContent(null);
    }
  }

  const shareHost = content ? (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ShareCard ref={cardRef} {...content} onImageReady={() => readyRef.current?.()} />
    </View>
  ) : null;

  return { share, shareHost, isSharing: !!content };
}

const styles = StyleSheet.create({
  // Laid out at full size (so the capture is exact) but parked outside the
  // visible screen.
  offscreen: {
    position: 'absolute',
    left: -SHARE_CARD_WIDTH * 4,
    top: 0,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  },
});
