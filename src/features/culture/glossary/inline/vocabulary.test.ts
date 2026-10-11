/** Contextual vocabulary: reviewed mapping integrity (against the real article text), missing entries, examples, saving. */
import * as path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { isSectionKey } from '@/features/culture/reader/navigator/sectionNavigator';
import type { CultureItemRow } from '@/services/content/types';
import { ownerStudy, useGlossaryStudyStore } from '@/store/useGlossaryStudyStore';

import { GLOSSARY } from '../glossaryData';
import { resolveGlossary } from '../glossaryModel';
import { seededCultureItems } from '../seededCultureItems';
import { buildInlineTermIndex, segmentText, selfEntryIds } from './inlineTermIndex';
import { GlossaryText, InlineGlossaryProvider } from './InlineGlossary';
import { exampleSentence, VOCAB_LINKS, vocabLinkFor, verifiedPronunciation } from './vocabularyLinks';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'kg' } }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/analytics/analytics', () => ({ track: () => undefined }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => 'user-a' }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));

const rows = seededCultureItems(path.join(__dirname, '../../../../..'));
const items = [...rows.values()] as unknown as CultureItemRow[];
const resolved = resolveGlossary(items);
jest.mock('../useGlossary', () => ({ useGlossary: () => ({ entries: (jest.requireActual('../glossaryModel') as typeof import('../glossaryModel')).resolveGlossary([...(jest.requireActual('../seededCultureItems') as typeof import('../seededCultureItems')).seededCultureItems(jest.requireActual('path').join(__dirname, '../../../../..')).values()] as never) }) }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return { Button: (props: Record<string, unknown>) => h('Button', props, props.label), IconButton: (props: Record<string, unknown>) => h('IconButton', props), MediaImage: () => null };
});

describe('the reviewed mapping', () => {
  it('every link resolves: real glossary entry, real article, a stable section key, the term in that section - and the inline glossary links it there', () => {
    const index = buildInlineTermIndex(resolved, 'kg');
    for (const link of VOCAB_LINKS) {
      expect(GLOSSARY.some((entry) => entry.id === link.glossaryId)).toBe(true);
      const row = rows.get(link.articleId);
      expect(row).toBeTruthy();
      expect(isSectionKey(link.sectionKey)).toBe(true);
      const text = String(row![link.sectionKey] ?? '');
      expect(text.length).toBeGreaterThan(0);
      const linked = segmentText(text, index, { exclude: selfEntryIds(resolved, link.articleId) }).filter((segment) => segment.kind === 'term').map((segment) => (segment.kind === 'term' ? segment.entryId : ''));
      expect({ link, linked: linked.includes(link.glossaryId) }).toEqual({ link, linked: true });
    }
    expect(new Set(VOCAB_LINKS.map((link) => `${link.articleId}#${link.sectionKey}#${link.glossaryId}`)).size).toBe(VOCAB_LINKS.length);
  });

  it('only the mapped (article, section, entry) gets the vocabulary panel', () => {
    expect(vocabLinkFor('boz-uy-overview', 'objects_used', 'tunduk')).toBeTruthy();
    expect(vocabLinkFor('boz-uy-overview', 'history', 'tunduk')).toBeNull();
    expect(vocabLinkFor(null, 'objects_used', 'tunduk')).toBeNull();
  });

  it('a glossary entry whose source is missing is not linked (no broken sheet)', () => {
    const withoutTunduk = resolveGlossary(items.filter((item) => item.id !== 'boz-uy-tunduk'));
    expect(withoutTunduk.some((entry) => entry.entry.id === 'tunduk')).toBe(false);
    const text = String(rows.get('boz-uy-overview')!.objects_used);
    const linked = segmentText(text, buildInlineTermIndex(withoutTunduk, 'kg')).flatMap((segment) => (segment.kind === 'term' ? [segment.entryId] : []));
    expect(linked).not.toContain('tunduk');
  });
});

describe('examples and audio', () => {
  it('the example is the sentence of the section that contains the word, quoted as written', () => {
    const text = 'First sentence. The tunduk sits on top! Another one.';
    expect(exampleSentence(text, 'Tunduk')).toBe('The tunduk sits on top!');
    expect(exampleSentence(text, 'kerege')).toBeNull();
    for (const link of VOCAB_LINKS) {
      const text = String(rows.get(link.articleId)![link.sectionKey]);
      const term = GLOSSARY.find((entry) => entry.id === link.glossaryId)!.term;
      const sentence = exampleSentence(text, term);
      expect(sentence).toBeTruthy();
      expect(text).toContain(sentence!);
    }
  });
  it('no verified recordings exist yet, so no pronunciation is offered', () => {
    for (const link of VOCAB_LINKS) expect(verifiedPronunciation(link.glossaryId)).toBeNull();
  });
});

describe('in an article', () => {
  let screen: ReactTestRenderer;
  const all = (testID: string) => screen.root.findAll((node: ReactTestInstance) => node.props.testID === testID && typeof node.type === 'string');
  beforeEach(async () => {
    await AsyncStorage.clear();
    useGlossaryStudyStore.setState({ isLoaded: true, saved: {}, sessions: {} });
  });
  afterEach(() => act(() => screen.unmount()));

  it('tap a mapped term -> example + no-audio note -> Add to my review uses the existing study queue', async () => {
    const text = String(rows.get('boz-uy-overview')!.objects_used);
    act(() => {
      screen = create(createElement(InlineGlossaryProvider, { articleItemId: 'boz-uy-overview', children: createElement(GlossaryText, { text, language: 'kg', sectionKey: 'objects_used', style: null }) }));
    });
    const link = screen.root.findAll((node) => node.props.accessibilityRole === 'link' && typeof node.props.onPress === 'function' && String(node.props.accessibilityLabel).toLowerCase().startsWith('түндүк'))[0];
    act(() => link.props.onPress());
    expect(all('vocab-example')).toHaveLength(1);
    expect(all('vocab-audio')[0].props.children).toBe('vocabulary.noAudio');
    await act(async () => {
      await all('vocab-save')[0].props.onPress();
    });
    expect(ownerStudy(useGlossaryStudyStore.getState().saved, 'user-a').tunduk).toMatchObject({ needsReview: true });
    expect(all('vocab-save')[0].props.disabled).toBe(true);
  });

  it('the same term in an unmapped section opens the plain sheet (no vocabulary panel)', () => {
    const text = String(rows.get('boz-uy-overview')!.cultural_meaning);
    act(() => {
      screen = create(createElement(InlineGlossaryProvider, { articleItemId: 'boz-uy-overview', children: createElement(GlossaryText, { text, language: 'kg', sectionKey: 'cultural_meaning', style: null }) }));
    });
    const link = screen.root.findAll((node) => node.props.accessibilityRole === 'link' && typeof node.props.onPress === 'function')[0];
    act(() => link.props.onPress());
    expect(all('vocab-panel')).toHaveLength(0);
  });
});
