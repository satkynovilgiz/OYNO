import { requireOptionalNativeModule } from 'expo';
import { Asset as ExpoAsset } from 'expo-asset';
import { Platform, Share } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

/**
 * Save / share for wallpapers. OYNO can't set the system wallpaper (iOS
 * doesn't allow apps to), so "Save Wallpaper" puts the image in Photos and
 * the user sets it from there.
 *
 * expo-media-library and expo-sharing resolve their native modules at
 * import time and throw when they're missing - true on any build made
 * before they were added (an OTA update can't add native code). So both
 * are checked first and required lazily; callers get an honest result
 * instead of a crash.
 */
/** 'downloaded' = web browser download (not the Photos app). */
export type SaveResult = 'saved' | 'downloaded' | 'denied' | 'unsupported' | 'error';

/** A local file URI for a bundled `require()`d image. */
async function localFileFor(image: ImageSourcePropType): Promise<string | null> {
  // Native bundles give `require()`d images as a numeric module id; the web
  // bundle gives an object that already carries its `uri`.
  if (typeof image === 'number') {
    const asset = ExpoAsset.fromModule(image);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri ?? null;
  }
  if (image && !Array.isArray(image) && typeof image === 'object' && typeof image.uri === 'string') return image.uri;
  return null;
}

export function canSaveWallpaper(): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return !!requireOptionalNativeModule('ExpoMediaLibraryNext');
  } catch {
    return false;
  }
}

export async function saveWallpaper(image: ImageSourcePropType, fileName: string): Promise<SaveResult> {
  try {
    const uri = await localFileFor(image);
    if (!uri) return 'error';

    if (Platform.OS === 'web') {
      // Browser download of the bundled file.
      const link = document.createElement('a');
      link.href = uri;
      link.download = `${fileName}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return 'downloaded';
    }

    if (!canSaveWallpaper()) return 'unsupported';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    // Write-only: OYNO never asks to read the user's photos for this.
    const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) return 'denied';
    await MediaLibrary.Asset.create(uri);
    return 'saved';
  } catch {
    return 'error';
  }
}

/** Shares the image file itself via the OS share sheet (which also offers
 * "Save Image"); falls back to a text share where file sharing isn't
 * available. */
export async function shareWallpaper(image: ImageSourcePropType, title: string, fallbackMessage: string): Promise<void> {
  try {
    const sharingAvailable = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoSharing');
    const uri = sharingAvailable ? await localFileFor(image) : null;
    if (sharingAvailable && uri) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: title });
      return;
    }
  } catch {
    // fall through to the text share
  }
  await Share.share({ message: fallbackMessage }).catch(() => {});
}
