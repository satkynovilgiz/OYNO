import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { applyAnswer, reviewQueue } from '@/features/culture/glossary/study/glossaryStudy';

import { MAX_RECORDING_MS, MICROPHONE_NATIVE_BUILD_READY, practiceEventProps, recordingSupport, referenceAudio } from './pronunciation';

const root = path.join(__dirname, '../../../../..');
const screen = fs.readFileSync(path.join(__dirname, 'GlossaryPracticeScreen.tsx'), 'utf8');
const audio = fs.readFileSync(path.join(__dirname, 'practiceAudio.ts'), 'utf8');
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

describe('Glossary Listen & Repeat', () => {
  it('uses the canonical Kyrgyz term with a KYRGYZ voice only', () => {
    expect(referenceAudio('Түндүк', null, true, [{ identifier: 'ky-voice', language: 'ky-KG' }])).toEqual({ kind: 'tts', voiceId: 'ky-voice', language: 'ky-KG' });
    // Russian/English voices never stand in for Kyrgyz.
    expect(referenceAudio('Түндүк', null, true, [{ identifier: 'ru', language: 'ru-RU' }, { identifier: 'en', language: 'en-US' }])).toEqual({ kind: 'unavailable' });
    expect(referenceAudio('Түндүк', null, false, [{ identifier: 'ky', language: 'ky-KG' }])).toEqual({ kind: 'unavailable' });
    expect(referenceAudio('', null, true, [{ identifier: 'ky', language: 'ky-KG' }])).toEqual({ kind: 'unavailable' });
  });

  it('a real recorded pronunciation wins over device speech', () => {
    expect(referenceAudio('Түндүк', 42, true, [{ identifier: 'ky', language: 'ky-KG' }])).toEqual({ kind: 'recorded', source: 42 });
  });

  it('recording is OFF in native builds without a microphone permission (no crash path)', () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')) as { expo: { plugins: unknown[] } };
    const audioPlugin = app.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio') as [string, { microphonePermission: unknown }];
    if (audioPlugin[1].microphonePermission === false) expect(MICROPHONE_NATIVE_BUILD_READY).toBe(false);
    expect(recordingSupport('ios')).toBe(MICROPHONE_NATIVE_BUILD_READY ? 'available' : 'needs_app_update');
    expect(recordingSupport('android')).toBe(MICROPHONE_NATIVE_BUILD_READY ? 'available' : 'needs_app_update');
    expect(recordingSupport('web', true)).toBe('available');
    expect(recordingSupport('web', false)).toBe('unsupported');
    // The recorder hook is mounted only inside <Recorder>, which renders only when available.
    expect(screen).toMatch(/support === 'available' \? \(\s*<Recorder/);
  });

  it('permission is asked only on the first Record tap; denial is handled honestly', () => {
    const start = screen.slice(screen.indexOf('const start = async'), screen.indexOf('const hearMine'));
    expect(start).toMatch(/requestRecordingPermissionsAsync\(\)/);
    expect(start).toMatch(/if \(!permission\.granted\) \{\s*setDenied\(true\);\s*return;/);
    expect(code(screen).match(/requestRecordingPermissionsAsync\(/g)).toHaveLength(1);
  });

  it('max 10 seconds; a new recording / retry / leaving deletes the previous file', () => {
    expect(MAX_RECORDING_MS).toBe(10_000);
    expect(screen).toMatch(/setTimeout\(\(\) => void stop\(\), MAX_RECORDING_MS\)/);
    expect(screen).toMatch(/if \(uriRef\.current && uriRef\.current !== next\) deleteRecording\(uriRef\.current\)/);
    expect(screen).toMatch(/replaceRecording\(null\);/);
    expect(screen).toMatch(/deleteRecording\(uriRef\.current\);\s*uriRef\.current = null;/);
  });

  it('privacy: no upload, sync, network or recording data in analytics', () => {
    const all = code(screen) + code(audio);
    expect(all).not.toMatch(/supabase|fetch\(|upload|useListeningStore|AsyncStorage|SecureStore/);
    for (const call of code(screen).match(/track\([^)]*\)\)?/g) ?? []) expect(call).toMatch(/practiceEventProps\((entry\.id|termId)\)/);
    expect(practiceEventProps('tunduk')).toEqual({ glossary_entry_id: 'tunduk' });
    expect(code(screen)).not.toMatch(/score|percent|accuracy|transcri|recogni/i);
  });

  it('"Practice again" uses the existing study model (needsReview), no new queue', () => {
    expect(screen).toMatch(/useGlossaryStudyStore\.getState\(\)\.answer\(owner, termId, 'review_again'\)/);
    const study = applyAnswer({}, 'tunduk', 'review_again');
    expect(reviewQueue(study, ['tunduk'])).toEqual(['tunduk']);
  });

  it('audio mutual exclusion: Audio Guide + Komuz stop before reference or recording; no reference while recording', () => {
    expect(audio).toMatch(/useAudioGuideStore\.getState\(\)\.stop\(\)/);
    expect(audio).toMatch(/useKomuzPlayerStore\.getState\(\)\.stop\(\)/);
    expect(screen.slice(screen.indexOf('const start = async'))).toMatch(/stopOtherAudio\(\);/);
    expect(screen).toMatch(/if \(!recording\) playReference/);
    expect(screen).toMatch(/disabled=\{recording\}/);
  });

  it('background/interruption stops the microphone; never resumes it', () => {
    expect(screen).toMatch(/if \(state !== 'active' && phase === 'recording'\) void stop\(\)/);
    expect(code(screen)).not.toMatch(/state === 'active'[^\n]*record\(\)/);
  });

  it('recording state is announced in words, not only colour; never autoplays a recording', () => {
    expect(screen).toMatch(/announceForAccessibility\?\.\(t\('pronunciation\.recording'\)\)/);
    expect(screen).toMatch(/announceForAccessibility\?\.\(t\('pronunciation\.recordingStopped'\)\)/);
    const stopBlock = screen.slice(screen.indexOf('const stop = useCallback'), screen.indexOf('const start = async'));
    expect(stopBlock).not.toMatch(/\.play\(\)/);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { pronunciation: Record<string, string> }).pronunciation;
      for (const key of ['title', 'hearTerm', 'nowYouTry', 'record', 'recording', 'stop', 'hearMine', 'tryAgain', 'done', 'practiceAgain', 'permissionTitle', 'privacy', 'unavailable']) expect(block[key]).toBeTruthy();
    }
    expect((en as unknown as { pronunciation: { unavailable: string } }).pronunciation.unavailable).toBe("Pronunciation audio isn't available on this device");
  });
});
