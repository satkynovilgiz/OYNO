import { requireOptionalNativeModule } from 'expo';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeModules, PixelRatio, Platform, Share, StyleSheet, TurboModuleRegistry, View } from 'react-native';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, ShareCard, shareCardSize, type ShareCardContent } from '@/components/share/ShareCard';
import { SharePreviewSheet, type ShareImageChoice } from '@/components/share/SharePreviewSheet';
import { showToast } from '@/components/ui/Toast';
import { recordDiagnostic } from '@/services/feedback/diagnosticTrail';
import { buildOYNODeepLink } from '@/services/links/contentLinks';
import { shareContentLink, type ShareableLink } from '@/services/links/shareContentLink';

import { discardPreviousExport, releaseExport, trackExport } from './exportFiles';

/** Target export size - a 4:5 social post (a postcard: its own size, 3x). */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;
const EXPORT_SCALE = SHARE_IMAGE_WIDTH / SHARE_CARD_WIDTH;

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

type PreviewState = { content: ShareCardContent; fallbackMessage: string; choices: ShareImageChoice[] | null; link: ShareableLink | null };

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
  share: (content: ShareCardContent, fallbackMessage: string, options?: { imageChoices?: ShareImageChoice[]; link?: ShareableLink }) => Promise<void>;
  shareHost: ReactNode;
  isSharing: boolean;
} {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [capturing, setCapturing] = useState<ShareCardContent | null>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const cardRef = useRef<View>(null);
  const readyRef = useRef<(() => void) | null>(null);
  /** One export at a time: a second Share/Save press (even in the same frame) is ignored. */
  const exportingRef = useRef(false);

  async function share(content: ShareCardContent, fallbackMessage: string, options: { imageChoices?: ShareImageChoice[]; link?: ShareableLink } = {}) {
    if (preview || capturing) return;
    // A public content link rides along in the text fallback (an image
    // share can't carry text) and as its own "Share link" action.
    const url = options.link ? buildOYNODeepLink(options.link) : null;
    setPreview({ content, fallbackMessage: url ? `${fallbackMessage}\n${url}` : fallbackMessage, choices: options.imageChoices ?? null, link: url ? options.link! : null });
  }

  /** Renders the card off-screen, waits for its picture, captures a JPEG. */
  async function capture(content: ShareCardContent): Promise<string> {
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    const ready = new Promise<void>((resolve) => {
      readyRef.current = resolve;
      giveUp = setTimeout(resolve, IMAGE_WAIT_MS);
    });
    discardPreviousExport();
    setCapturing(content);
    if (!content.imageSource) setTimeout(() => readyRef.current?.(), 50);
    try {
      await ready;
      // One extra frame so the loaded image is actually painted.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      const scale = PixelRatio.get();
      const size = shareCardSize(content);
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.92, result: 'tmpfile', width: (size.width * EXPORT_SCALE) / scale, height: (size.height * EXPORT_SCALE) / scale });
      trackExport(uri);
      return uri;
    } finally {
      clearTimeout(giveUp);
      readyRef.current = null;
      setCapturing(null);
    }
  }

  /**
   * The preview stays open until the image has really been handed over:
   * if capture or the share sheet fails, the same card (the caller's exact
   * composition) is still showing and Share can simply be pressed again.
   */
  async function confirmShare(content: ShareCardContent) {
    if (!preview || exportingRef.current) return;
    const fallback = preview.fallbackMessage;
    if (!imageShareSupported()) {
      recordDiagnostic('native_unavailable', 'image_share');
      setPreview(null);
      await shareText(fallback);
      return;
    }
    exportingRef.current = true;
    setBusy('share');
    let uri: string | null = null;
    try {
      uri = await capture(content);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: content.title });
      setPreview(null);
    } catch {
      if (uri) releaseExport(uri);
      recordDiagnostic('screen_error', 'share_capture');
      showToast(t('journal.v2.shareFailed'), { tone: 'info' });
    } finally {
      exportingRef.current = false;
      setBusy(null);
    }
  }

  async function confirmSave(content: ShareCardContent) {
    if (!preview || exportingRef.current) return;
    exportingRef.current = true;
    setBusy('save');
    let uri: string | null = null;
    try {
      uri = await capture(content);
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
      // Photos keeps its own copy; the temporary file is never needed again.
      if (uri) releaseExport(uri);
      exportingRef.current = false;
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
          onShareLink={
            preview.link
              ? () => {
                  const link = preview.link!;
                  setPreview(null);
                  void shareContentLink(link);
                }
              : undefined
          }
        />
      ) : null}
      {capturing ? (
        <View style={[styles.offscreen, shareCardSize(capturing)]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
