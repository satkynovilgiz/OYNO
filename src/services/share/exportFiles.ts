/**
 * Captured share images are temporary files (react-native-view-shot
 * `tmpfile`). At most ONE is kept: the previous one is deleted when a new
 * capture starts, and a saved one is deleted right after it has been copied
 * into Photos. A file handed to the share sheet is kept until the next
 * export, because the receiving app may read it after the sheet closes.
 */
let current: string | null = null;

const asUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

export function deleteExportFile(path: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(asUri(path));
    if (file.exists) file.delete();
  } catch {
    // Best effort: a file the OS already purged, or no file system (web).
  }
}

/** Before a new capture: the last export is no longer needed. */
export function discardPreviousExport(): void {
  if (current) deleteExportFile(current);
  current = null;
}

export function trackExport(path: string): void {
  if (current && current !== path) deleteExportFile(current);
  current = path;
}

/** The export has been used up (saved, or the attempt failed). */
export function releaseExport(path: string): void {
  deleteExportFile(path);
  if (current === path) current = null;
}

export const currentExportForTests = () => current;
