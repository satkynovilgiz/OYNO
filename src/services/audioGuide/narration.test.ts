import { estimateListenMinutes, joinNarration, resolveAudioPlan, splitIntoChunks, voiceMatchesLanguage } from './narration';

const voices = [
  { identifier: 'ru-voice', language: 'ru-RU' },
  { identifier: 'en-voice', language: 'en-US' },
  { identifier: 'tr-voice', language: 'tr-TR' },
];

describe('voiceMatchesLanguage', () => {
  it('matches Kyrgyz only to a real ky voice', () => {
    expect(voiceMatchesLanguage('ky-KG', 'kg')).toBe(true);
    expect(voiceMatchesLanguage('ky', 'kg')).toBe(true);
    expect(voiceMatchesLanguage('ru-RU', 'kg')).toBe(false);
    expect(voiceMatchesLanguage('tr-TR', 'kg')).toBe(false);
    expect(voiceMatchesLanguage('en_GB', 'en')).toBe(true);
  });
});

describe('resolveAudioPlan', () => {
  const kgText = { lang: 'kg' as const, text: 'Боз үй - көчмөндөрдүн үйү. Анын түндүгү бар.' };

  it('prefers a recorded file over TTS', () => {
    const plan = resolveAudioPlan({ appLanguage: 'kg', narration: kgText, recorded: 42, ttsAvailable: true, voices });
    expect(plan).toEqual({ kind: 'recorded', source: 42 });
  });

  it('never reads Kyrgyz text with a Russian/English voice', () => {
    expect(resolveAudioPlan({ appLanguage: 'kg', narration: kgText, recorded: null, ttsAvailable: true, voices })).toEqual({
      kind: 'unavailable',
      reason: 'noVoice',
    });
  });

  it('uses a Kyrgyz voice when the device has one', () => {
    const plan = resolveAudioPlan({ appLanguage: 'kg', narration: kgText, recorded: null, ttsAvailable: true, voices: [...voices, { identifier: 'ky-voice', language: 'ky-KG' }] });
    expect(plan).toMatchObject({ kind: 'tts', voiceId: 'ky-voice', bcp47: 'ky-KG' });
  });

  it('does not read Kyrgyz-only content to a Russian/English user', () => {
    expect(resolveAudioPlan({ appLanguage: 'ru', narration: kgText, recorded: null, ttsAvailable: true, voices })).toEqual({
      kind: 'unavailable',
      reason: 'noContentInLanguage',
    });
  });

  it('reads real Russian content with a Russian voice', () => {
    const plan = resolveAudioPlan({ appLanguage: 'ru', narration: { lang: 'ru', text: 'Юрта. Дом кочевника.' }, recorded: null, ttsAvailable: true, voices });
    expect(plan).toMatchObject({ kind: 'tts', voiceId: 'ru-voice' });
  });

  it('reports a missing speech engine and empty content', () => {
    expect(resolveAudioPlan({ appLanguage: 'en', narration: { lang: 'en', text: 'Hi.' }, recorded: null, ttsAvailable: false, voices }).kind).toBe('unavailable');
    expect(resolveAudioPlan({ appLanguage: 'en', narration: { lang: 'en', text: ' ' }, recorded: null, ttsAvailable: true, voices })).toEqual({ kind: 'unavailable', reason: 'empty' });
  });
});

describe('splitIntoChunks', () => {
  it('splits into sentence groups under the max length', () => {
    const chunks = splitIntoChunks('One. Two! Three? Four.', 10);
    expect(chunks).toEqual(['One. Two!', 'Three?', 'Four.']);
  });
  it('keeps a trailing sentence without punctuation', () => {
    expect(splitIntoChunks('Hello there')).toEqual(['Hello there']);
  });
});

describe('joinNarration / estimateListenMinutes', () => {
  it('joins visible parts with sentence breaks and skips empties', () => {
    expect(joinNarration(['Title', null, ' Body text. '])).toBe('Title. Body text.');
  });
  it('estimates at least one minute', () => {
    expect(estimateListenMinutes('a b c')).toBe(1);
    expect(estimateListenMinutes('word '.repeat(300))).toBe(2);
  });
});
