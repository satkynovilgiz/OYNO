import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Export needs a real file + the system share sheet (native only; the
 * web build has no safe file hand-off, so the action is not offered). */
export function learningExportSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!requireOptionalNativeModule('ExpoSharing') && !!requireOptionalNativeModule('FileSystem');
  } catch {
    return false;
  }
}

/**
 * Writes the JSON to a temporary cache file, opens the share sheet, then
 * removes the temporary file. Nothing is uploaded by OYNO.
 */
export async function shareLearningExport(json: string, fileName: string): Promise<'shared' | 'unsupported' | 'failed'> {
  if (!learningExportSupported()) return 'unsupported';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const file = new File(Paths.cache, fileName);
  try {
    file.create({ overwrite: true });
    file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: fileName });
    return 'shared';
  } catch {
    return 'failed';
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // Best effort - the OS clears the cache folder too.
    }
  }
}
