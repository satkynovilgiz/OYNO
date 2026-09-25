import { requireOptionalNativeModule } from 'expo';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeModules, PixelRatio, Platform, Share, StyleSheet, TurboModuleRegistry, View } from 'react-native';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, ShareCard, type ShareCardContent } from '@/components/share/ShareCard';
import { SharePreviewSheet, type ShareImageChoice } from '@/components/share/SharePreviewSheet';
import { showToast } from '@/components/ui/Toast';
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

function imageSaveSupported(): boolean {
  if (!imageShareSupported()) return false;
  try {
    return !!requireOptionalNativeModule('ExpoMediaLibraryNext') || !!requireOptionalNativeModule('ExpoMediaLibrary');
  } catch {
    return false;
  }
}

async function shareText(message: string) {
  // Rejects on web without the Web Share API or when the user dismisses the
  // sheet - neither is an error worth surfacing (app-wide convention).
  await Share.share({ message }).catch(() => {});
}

type PreviewState = { content: ShareCardContent; fallbackMessage: string; choices: ShareImageChoice[] | null };

/**
 * Sharing is always explicit and previewed:
 *
 *   share(content, fallbackMessage, { imageChoices? })
 *     opens a preview sheet showing the exact card. The user can pick the
 *     picture (when choices are offered - e.g. Journal: OYNO artwork, their
 *     own photo, or none), then Share, Save to Photos, or Cancel.
 *
 * Only on Share/Save is one ShareCard rendered off-screen, captured at
 * 1080×1350 and handed to the OS - nothing is exported in the background.
 * Failures are reported honestly (toast), never as success; builds or
 * platforms without image sharing share the text instead, by design.
 * Mount `shareHost` anywhere in the calling screen.
 */
export function useShareCard(): {
  share: (content: ShareCardContent, fallbackMessage: string, options?: { imageChoices?: ShareImageChoice[] }) => Promise<void>;
  shareHost: ReactNode;
  isSharing: boolean;
} {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [capturing, setCapturing] = useState<ShareCardContent | null>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const cardRef = useRef<View>(null);
  const readyRef = useRef<(() => void) | null>(null);

  async function share(content: ShareCardContent, fallbackMessage: string, options: { imageChoices?: ShareImageChoice[] } = {}) {
    if (preview || capturing) return;
    setPreview({ content, fallbackMessage, choices: options.imageChoices ?? null });
  }

  /** Renders the card off-screen, waits for its picture, captures a JPEG. */
  async function capture(content: ShareCardContent): Promise<string> {
    const ready = new Promise<void>((resolve) => {
      readyRef.current = resolve;
      setTimeout(resolve, IMAGE_WAIT_MS);
    });
    setCapturing(content);
    if (!content.imageSource) setTimeout(() => readyRef.current?.(), 50);
    try {
      await ready;
      // One extra frame so the loaded image is actually painted.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      const scale = PixelRatio.get();
      return await captureRef(cardRef, { format: 'jpg', quality: 0.92, result: 'tmpfile', width: SHARE_IMAGE_WIDTH / scale, height: SHARE_IMAGE_HEIGHT / scale });
    } finally {
      readyRef.current = null;
      setCapturing(null);
    }
  }

  async function confirmShare(content: ShareCardContent) {
    if (!preview) return;
    const fallback = preview.fallbackMessage;
    if (!imageShareSupported()) {
      recordDiagnostic('native_unavailable', 'image_share');
      setPreview(null);
      await shareText(fallback);
      return;
    }
    setBusy('share');
    try {
      const uri = await capture(content);
      setPreview(null);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: content.title });
    } catch {
      recordDiagnostic('screen_error', 'share_capture');
      showToast(t('journal.v2.shareFailed'), { tone: 'info' });
    } finally {
      setBusy(null);
    }
  }

  async function confirmSave(content: ShareCardContent) {
    setBusy('save');
    try {
      const uri = await capture(content);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
      // Write-only permission: OYNO never reads the photo library for this.
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        showToast(t('journal.v2.savePermission'), { tone: 'info' });
        return;
      }
      await MediaLibrary.Asset.create(uri);
      setPreview(null);
      showToast(t('journal.v2.savedToPhotos'), { haptic: true });
    } catch {
      showToast(t('journal.v2.saveFailed'), { tone: 'info' });
    } finally {
      setBusy(null);
    }
  }

  const shareHost = (
    <>
      {preview ? (
        <SharePreviewSheet
          content={preview.content}
          choices={preview.choices}
          busy={busy}
          canSave={imageSaveSupported()}
          onShare={(content) => void confirmShare(content)}
          onSave={(content) => void confirmSave(content)}
          onCancel={() => !busy && setPreview(null)}
        />
      ) : null}
      {capturing ? (
        <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ShareCard ref={cardRef} {...capturing} onImageReady={() => readyRef.current?.()} />
        </View>
      ) : null}
    </>
  );

  return { share, shareHost, isSharing: !!preview || !!capturing };
}

export type { ShareImageChoice };

const styles = StyleSheet.create({
  // Laid out at full size (so the capture is exact) but parked outside the
  // visible screen.
  offscreen: { position: 'absolute', left: -SHARE_CARD_WIDTH * 4, top: 0, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT },
});
