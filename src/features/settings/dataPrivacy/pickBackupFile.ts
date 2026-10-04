import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { MAX_FILE_BYTES } from './learningImport';

export type PickedBackup = { status: 'picked'; text: string; size: number } | { status: 'canceled' } | { status: 'too_large' } | { status: 'unsupported' } | { status: 'failed' };

/**
 * Lets the person choose a backup file and reads it as text. Reading a file
 * never changes any data (stage 1 only). Oversized files are refused
 * before they are read.
 */
export async function pickBackupFile(): Promise<PickedBackup> {
  if (Platform.OS === 'web') return pickOnWeb();
  try {
    if (!requireOptionalNativeModule('FileSystem')) return { status: 'unsupported' };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    if (typeof File.pickFileAsync !== 'function') return { status: 'unsupported' };
    const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', 'public.json'] });
    if (picked.canceled || !picked.result) return { status: 'canceled' };
    const file = picked.result;
    const size = file.size ?? 0;
    if (size > MAX_FILE_BYTES) return { status: 'too_large' };
    return { status: 'picked', text: await file.text(), size };
  } catch {
    return { status: 'failed' };
  }
}

function pickOnWeb(): Promise<PickedBackup> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve({ status: 'unsupported' });
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('cancel', () => resolve({ status: 'canceled' }));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve({ status: 'canceled' });
      if (file.size > MAX_FILE_BYTES) return resolve({ status: 'too_large' });
      file
        .text()
        .then((text) => resolve({ status: 'picked', text, size: file.size }))
        .catch(() => resolve({ status: 'failed' }));
    });
    input.click();
  });
}
