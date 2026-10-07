/**
 * "What you discovered" after real sequences of rounds - driven through the
 * screen itself (react-test-renderer; no @testing-library in this project)
 * plus the pure visit helpers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { create as createStore } from 'zustand';

import { cultureItemImages } from '@/features/culture/data';
import { ownerDetective, useDetectiveStore } from '@/store/useDetectiveStore';

import { DetectiveScreen } from './DetectiveScreen';
import { CLUE_POINTS, type Answer } from './detectiveModel';
import { challengeTotal, recordRound, summaryRows, visitFor } from './expeditionVisit';
import { expedition } from './expeditions';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
// Plain stand-ins for the design-system controls (they pull in Reanimated): same props, same handlers.
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/analytics/useTrackScreenView', () => ({ useTrackScreenView: () => undefined }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
const mockOwner = createStore<{ owner: string }>(() => ({ owner: 'user-a' }));
jest.mock('@/features/games/records/useGameRecords', () => ({ useRecordsOwner: () => mockOwner((state) => state.owner) }));

let screen: ReactTestRenderer;
const byId = (testID: string): ReactTestInstance | null => screen.root.findAll((node) => node.props.testID === testID && typeof node.props.onPress === 'function')[0] ?? null;
const exists = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
const textOf = (testID: string) => {
  const node = screen.root.findAll((item) => item.props.testID === testID)[0];
  const parts: string[] = [];
  const walk = (value: ReactTestInstance | string) => (typeof value === 'string' ? parts.push(value) : value.children.forEach(walk));
  if (node) walk(node);
  return parts.join('');
};
const press = (testID: string) => {
  const node = byId(testID);
  if (!node) throw new Error(`nothing to press: ${testID}`);
  act(() => node.props.onPress());
};

/** The source of the question on screen: the option whose bundled artwork is the one shown. */
function currentSource(): string {
  const shown = screen.root.findAll((node) => node.props.testID === 'detective-artwork')[0].props.source;
  const options = screen.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('detective-option-') && typeof node.props.onPress === 'function').map((node) => (node.props.testID as string).slice('detective-option-'.length));
  return options.find((id) => cultureItemImages[id]?.[0] === shown)!;
}
function optionIds(): string[] {
  return [...new Set(screen.root.findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('detective-option-')).map((node) => (node.props.testID as string).slice('detective-option-'.length)))];
}

/** Answers the round in progress: wrong for the sources in `miss`, right otherwise. Returns the sources asked. */
function playRound(miss: string[] = []): string[] {
  const asked: string[] = [];
  while (exists('detective-question')) {
    const source = currentSource();
    asked.push(source);
    const choice = miss.includes(source) ? optionIds().find((id) => id !== source)! : source;
    press(`detective-option-${choice}`);
    press('detective-next');
  }
  return asked;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useDetectiveStore.setState({ saved: {}, isLoaded: true });
  mockOwner.setState({ owner: 'user-a' });
  act(() => {
    screen = create(createElement(DetectiveScreen, { onPressBack: () => undefined }));
  });
});
afterEach(() => act(() => screen.unmount()));

const missedIn = (owner: string, id: 'yurt' | 'horse' | 'ornament') => ownerDetective(useDetectiveStore.getState().saved, owner).expeditions[id]?.missedIds ?? [];

describe('practice sequences', () => {
  it('miss two, fix one in practice, then the other: neither is offered again', () => {
    press('expedition-yurt');
    press('expedition-start');
    expect(playRound(['boz-uy-tunduk', 'boz-uy-karkas'])).toHaveLength(5);
    press('expedition-skip');
    expect(missedIn('user-a', 'yurt').sort()).toEqual(['karkas', 'tunduk']);
    expect(exists('discovered-practise')).toBe(true);

    // Practice 1: tunduk right, karkas wrong again.
    press('discovered-practise');
    expect(playRound(['boz-uy-karkas']).sort()).toEqual(['boz-uy-karkas', 'boz-uy-tunduk']);
    expect(missedIn('user-a', 'yurt')).toEqual(['karkas']);
    expect(textOf('discovered-tunduk')).toContain('expeditions.practiceRight');
    expect(textOf('discovered-karkas')).toContain('expeditions.practiceWrong');

    // Practice 2: only karkas is asked, and answered right.
    press('discovered-practise');
    expect(playRound()).toEqual(['boz-uy-karkas']);
    expect(missedIn('user-a', 'yurt')).toEqual([]);
    // tunduk's earlier correction is kept (merged, latest per question), nothing is offered again.
    expect(textOf('discovered-tunduk')).toContain('expeditions.practiceRight');
    expect(textOf('discovered-karkas')).toContain('expeditions.practiceRight');
    expect(exists('discovered-practise')).toBe(false);
    // The original learning results stay as they were answered, apart from practice.
    expect(textOf('discovered-tunduk')).toContain('expeditions.learnedWrong');
  });

  it('a yurt challenge, then horse practice: no yurt score or answers in the horse summary', () => {
    act(() => useDetectiveStore.getState().recordExpedition('user-a', 'horse', { round: 'learning', correct: 4, total: 5, score: 4, maxScore: 20, missedIds: ['eer'], askedIds: expedition('horse')!.questionIds }));
    press('expedition-yurt');
    press('expedition-start');
    playRound();
    press('expedition-challenge');
    playRound();
    expect(exists('discovered-challenge-score')).toBe(true);
    expect(exists('discovered-tunduk')).toBe(true);

    expect(exists('discovered-practise')).toBe(false); // nothing missed in yurt

    press('discovered-back');
    press('expedition-horse');
    press('expedition-practise');
    expect(playRound()).toEqual(['horse-eer']);
    expect(exists('expedition-discovered')).toBe(true);
    expect(exists('discovered-challenge-score')).toBe(false);
    expect(exists('discovered-tunduk')).toBe(false);
    const all = textOf('expedition-discovered');
    expect(all).not.toContain('expeditions.challenge');
    expect(all).not.toContain('expeditions.learned');
    expect(textOf('discovered-eer')).toContain('expeditions.practiceRight');
    // The yurt challenge itself is still recorded, in its own category.
    expect(ownerDetective(useDetectiveStore.getState().saved, 'user-a').expeditions.yurt?.challenge?.rounds).toBe(1);
  });
});

describe('switching accounts', () => {
  it('a round in progress is dropped - never saved for either account', () => {
    press('expedition-yurt');
    press('expedition-start');
    for (let index = 0; index < 4; index += 1) {
      press(`detective-option-${currentSource()}`);
      press('detective-next');
    }
    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(exists('detective-question')).toBe(false);
    expect(exists('detective-intro')).toBe(true);
    expect(useDetectiveStore.getState().saved).toEqual({});
  });

  it("a finished summary is never shown to the next account, and quick play isn't touched", () => {
    act(() => useDetectiveStore.getState().recordSession('user-a', { score: 12, missedIds: ['eer'], askedIds: ['eer'], focus: false }));
    press('expedition-yurt');
    press('expedition-start');
    playRound(['boz-uy-tunduk']);
    press('expedition-challenge');
    playRound();
    expect(exists('discovered-challenge-score')).toBe(true);

    act(() => mockOwner.setState({ owner: 'user-b' }));
    expect(exists('expedition-discovered')).toBe(false);
    // B opens the same expedition: nothing of A's.
    press('expedition-yurt');
    expect(exists('expedition-practise')).toBe(false);
    expect(textOf('expedition-yurt')).not.toContain('bestLearning');
    expect(ownerDetective(useDetectiveStore.getState().saved, 'user-b')).toMatchObject({ sessions: 0, expeditions: {} });

    // Back to A: A's records are intact (quick play and both categories), the old visit is gone.
    act(() => mockOwner.setState({ owner: 'user-a' }));
    const a = ownerDetective(useDetectiveStore.getState().saved, 'user-a');
    expect(a).toMatchObject({ bestScore: 12, sessions: 1, lastMissedIds: ['eer'] });
    expect(a.expeditions.yurt).toMatchObject({ learning: { bestCorrect: 4, total: 5 }, challenge: { rounds: 1 } });
    expect(exists('expedition-discovered')).toBe(false);
  });
});

describe('visit helpers', () => {
  const answer = (questionId: string, correct: boolean, points = correct ? 1 : 0): Answer => ({ questionId, chosen: 'x', correct, cluesRevealed: 3, points });

  it('belongs to one owner and one expedition', () => {
    const visit = recordRound(null, 'user-a', 'yurt', 'challenge', [answer('tunduk', true, 4)]);
    expect(visitFor(visit, 'user-b', 'yurt')).toBeNull();
    expect(visitFor(visit, 'user-a', 'horse')).toBeNull();
    // A round elsewhere starts afresh.
    const horse = recordRound(visit, 'user-a', 'horse', 'practice', [answer('eer', true)]);
    expect(horse).toMatchObject({ id: 'horse', learning: null, challenge: null });
    expect(challengeTotal(horse, CLUE_POINTS[0])).toBeNull();
    expect(recordRound(visit, 'user-b', 'yurt', 'practice', []).challenge).toBeNull();
  });

  it('merges practice by question (latest wins) and keeps learning/challenge as answered', () => {
    let visit = recordRound(null, 'guest', 'yurt', 'learning', [answer('tunduk', false), answer('karkas', false), answer('boz-uy', true)]);
    visit = recordRound(visit, 'guest', 'yurt', 'practice', [answer('tunduk', true), answer('karkas', false)]);
    visit = recordRound(visit, 'guest', 'yurt', 'practice', [answer('karkas', true)]);
    const rows = Object.fromEntries(summaryRows(visit, expedition('yurt')!).map((row) => [row.questionId, row]));
    expect(rows.tunduk).toMatchObject({ learning: { correct: false }, practice: { correct: true }, challenge: null });
    expect(rows.karkas).toMatchObject({ learning: { correct: false }, practice: { correct: true } });
    // A new learning round starts a new visit.
    expect(recordRound(visit, 'guest', 'yurt', 'learning', []).practice).toEqual({});
  });
});
