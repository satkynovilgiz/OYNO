import { komuzTracks } from '@/features/culture/audioData';
import { useKomuzPlayerStore } from '@/features/culture/komuz/listening/useKomuzPlayerStore';
import { currentRecordsOwner } from '@/features/games/records/useGameRecords';
import { useAudioGuideStore } from '@/services/audioGuide/useAudioGuideStore';
import { useListeningStore } from '@/store/useListeningStore';

import type { ListeningRecord } from './listeningModel';

const POSITION_INTERVAL_MS = 5000;
let installed = false;

function write(input: Omit<ListeningRecord, 'key' | 'lastListenedAt'>) {
  const owner = currentRecordsOwner();
  const store = useListeningStore.getState();
  const apply = () => useListeningStore.getState().record(owner, { ...input, at: new Date().toISOString() });
  if (store.isLoaded) apply();
  else void store.load().then(apply);
}

/** The content key of a guide session (`<contentKey>:<lang>`). */
export function contentKeyOf(sessionKey: string): string {
  return sessionKey.replace(/:(kg|ru|en)$/, '');
}

/**
 * Records listening from the players' REAL events only (a user-started
 * session, pauses, the end) - never from a screen opening. Positions are
 * written at most every few seconds. Installed once at the app root.
 */
export function installListeningTracker(): void {
  if (installed) return;
  installed = true;

  let guideWrittenAt = 0;
  useAudioGuideStore.subscribe((state, previous) => {
    if (!state.sessionKey || !state.meta?.route) return;
    if (state.status === 'idle' || state.status === 'error') return;
    const statusChanged = state.status !== previous.status || state.sessionKey !== previous.sessionKey;
    const now = Date.now();
    if (!statusChanged && now - guideWrittenAt < POSITION_INTERVAL_MS) return;
    guideWrittenAt = now;
    // Recording: real seconds; device speech: the section (chunk) only.
    const positionType = state.canSeek ? 'seconds' : 'chunk';
    const position = state.canSeek ? state.elapsed : state.chunk;
    write({
      sourceType: 'guide',
      sourceId: contentKeyOf(state.sessionKey),
      title: state.meta.title,
      route: state.meta.route,
      positionType: position === null ? null : positionType,
      position,
      completed: state.status === 'finished',
    });
  });

  let komuzWrittenAt = 0;
  useKomuzPlayerStore.subscribe((state, previous) => {
    const finished = state.lastFinished && state.lastFinished !== previous.lastFinished ? state.lastFinished.trackId : null;
    const trackId = finished ?? state.currentTrackId;
    if (!trackId) return;
    const track = komuzTracks.find((entry) => entry.id === trackId);
    if (!track) return;
    const started = state.playing && (!previous.playing || state.currentTrackId !== previous.currentTrackId);
    const paused = !state.playing && previous.playing;
    const now = Date.now();
    if (!finished && !started && !paused && !(state.playing && now - komuzWrittenAt >= POSITION_INTERVAL_MS)) return;
    komuzWrittenAt = now;
    write({
      sourceType: 'komuz',
      sourceId: track.id,
      title: track.title,
      route: '/culture/komuz/listen',
      positionType: finished ? null : 'seconds',
      position: finished ? null : state.position,
      completed: !!finished,
    });
  });
}
