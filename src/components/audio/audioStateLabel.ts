import type { AudioGuideStatus } from '@/services/audioGuide/useAudioGuideStore';

/** One status line, shared by the full and the mini player so they always agree. */
export function audioStateLabel(t: (key: string) => string, status: AudioGuideStatus, errorKind: 'recording' | 'speech' | null): string {
  switch (status) {
    case 'loading':
      return t('audioGuide.loading');
    case 'error':
      return t(errorKind === 'speech' ? 'audioGuide.errorSpeech' : 'audioGuide.error');
    case 'finished':
      return t('audioGuide.finished');
    case 'paused':
      return t('audioGuide.paused');
    default:
      return t('audioGuide.title');
  }
}
