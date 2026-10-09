import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { handOffToCreator, takeCreatorHandoff } from '@/services/culture/oymoHandoff';

import { toCreatorCopy } from './playgroundModel';
import { compare, equalSets, LEVELS, REMEMBER_PATTERNS, rememberReducer, startRemember, validatePattern, type RememberState } from './rememberModel';
import { RememberPatternScreen } from './RememberPatternScreen';

jest.mock('react-i18next', () => ({ initReactI18next: { type: '3rdParty', init: () => undefined }, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/services/ageExperience/useAgeExperience', () => ({ useAgeExperience: () => ({ experience: 'adult' }) }));
jest.mock('@/services/a11y/announce', () => ({ announce: () => undefined }));
jest.mock('@/components/ui', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    AnimatedPressable: (props: Record<string, unknown>) => h('AnimatedPressable', props, props.children),
    Button: (props: Record<string, unknown>) => h('Button', props, props.label),
    IconButton: (props: Record<string, unknown>) => h('IconButton', props),
  };
});

const corners = REMEMBER_PATTERNS.find((pattern) => pattern.id === 'corners')!;
const run = (state: RememberState, ...actions: Parameters<typeof rememberReducer>[1][]) => actions.reduce(rememberReducer, state);
const place = (col: number, row: number, motifId: string) => ({ type: 'edit' as const, action: { type: 'place' as const, cell: { col, row }, motifId } });

describe('patterns', () => {
  it('six authored patterns, two per level, all valid', () => {
    expect(REMEMBER_PATTERNS).toHaveLength(6);
    for (const level of LEVELS) expect(REMEMBER_PATTERNS.filter((pattern) => pattern.level === level)).toHaveLength(2);
    for (const pattern of REMEMBER_PATTERNS) expect(validatePattern(pattern)).toEqual([]);
    const problems = validatePattern({ id: 'bad', level: 'hard', marks: [{ cell: { col: 5, row: 0 }, motifId: 'gul' }, { cell: { col: 5, row: 0 }, motifId: 'gul' }] });
    expect(problems).toContain('bad: cell outside the grid');
    expect(problems).toContain('bad: two motifs on 5,0');
    expect(problems).toContain('bad: 2 pieces for hard');
  });
});

describe('matching (model, not pixels)', () => {
  it('exact (cell, motif) set; a right cell with another motif, missing and extra pieces are told apart', () => {
    let state = run(startRemember(corners), { type: 'hide' }, place(0, 0, 'muyuz'), place(4, 4, 'gul'), place(1, 1, 'gul'));
    expect(compare(corners, state.editor.design)).toEqual({ matched: 1, missing: 1, extra: 1, wrongMotif: 1, solved: false });
    state = run(startRemember(corners), { type: 'hide' }, place(0, 0, 'muyuz'), place(4, 4, 'muyuz'), place(2, 2, 'gul'));
    expect(compare(corners, state.editor.design).solved).toBe(true);
    // compare agrees with the playground's own set comparison for every authored pattern.
    for (const pattern of REMEMBER_PATTERNS) {
      const built = run(startRemember(pattern), { type: 'hide' }, ...pattern.marks.map((mark) => place(mark.cell.col, mark.cell.row, mark.motifId)));
      expect(compare(pattern, built.editor.design).solved).toBe(true);
      expect(equalSets(pattern, built.editor.design)).toBe(true);
    }
  });
});

describe('the attempt', () => {
  it('Check gives gentle feedback and only finishes on an exact match', () => {
    let state = run(startRemember(corners), { type: 'hide' }, place(0, 0, 'muyuz'), { type: 'check' });
    expect(state).toMatchObject({ phase: 'building', checks: 1, feedback: { matched: 1, missing: 2 } });
    state = run(state, place(4, 4, 'muyuz'), place(2, 2, 'gul'));
    expect(state.feedback).toBeNull(); // editing clears old feedback
    state = run(state, { type: 'check' });
    expect(state).toMatchObject({ phase: 'done', checks: 2, assisted: false });
  });

  it('Show again keeps the rebuild and marks the attempt as assisted', () => {
    let state = run(startRemember(corners), { type: 'hide' }, place(0, 0, 'muyuz'), { type: 'showAgain' });
    expect(state).toMatchObject({ phase: 'viewing', assisted: true, views: 2 });
    state = run(state, { type: 'hide' });
    expect(state.editor.design.pieces).toHaveLength(1);
    state = run(state, place(4, 4, 'muyuz'), place(2, 2, 'gul'), { type: 'check' });
    expect(state).toMatchObject({ phase: 'done', assisted: true });
  });

  it('Undo, removal and no editing while viewing; no symmetry; restart resets everything', () => {
    let state = run(startRemember(corners), place(0, 0, 'muyuz'));
    expect(state.editor.design.pieces).toHaveLength(0); // still viewing
    state = run(state, { type: 'hide' }, place(0, 0, 'muyuz'), place(1, 0, 'gul'), { type: 'edit', action: { type: 'undo' } });
    expect(state.editor.design.pieces.map((piece) => piece.motifId)).toEqual(['muyuz']);
    state = run(state, { type: 'edit', action: { type: 'remove', id: state.editor.design.pieces[0].id } });
    expect(state.editor.design.pieces).toEqual([]);
    expect(run(state, { type: 'edit', action: { type: 'mode', mode: 'fourWay' } }).editor.design.mode).toBe('none');
    state = run(state, { type: 'showAgain' }, { type: 'restart' });
    expect(state).toMatchObject({ phase: 'viewing', assisted: false, views: 1, checks: 0, editor: { history: [] } });
  });

  it('opening the result in the Creator hands over an unsaved deep copy, never a saved pattern', () => {
    const state = run(startRemember(corners), { type: 'hide' }, place(0, 0, 'muyuz'), place(4, 4, 'muyuz'), place(2, 2, 'gul'), { type: 'check' });
    const before = JSON.stringify(state.editor.design);
    const copy = toCreatorCopy(state.editor.design, '#2F5D3A');
    handOffToCreator(copy.state, { symmetry: 'none', source: 'remember' });
    const taken = takeCreatorHandoff()!;
    expect(taken).toMatchObject({ source: 'remember', symmetry: 'none' });
    expect(taken.state).not.toHaveProperty('id');
    taken.state.layers[0].point.x = 0;
    expect(JSON.stringify(state.editor.design)).toBe(before);
  });
});

describe('the screen: viewing time', () => {
  let screen: ReactTestRenderer;
  const press = (testID: string) => act(() => screen.root.findAll((node) => node.props.testID === testID && node.props.onPress)[0].props.onPress());
  const has = (testID: string) => screen.root.findAll((node) => node.props.testID === testID).length > 0;
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => {
      screen = create(createElement(RememberPatternScreen, { onPressBack: () => undefined }));
    });
  });
  afterEach(() => {
    act(() => screen.unmount());
    jest.useRealTimers();
  });

  it('untimed (default): the reference stays until the player hides it; the description is always there', () => {
    press('remember-start');
    act(() => jest.advanceTimersByTime(120_000));
    expect(has('remember-viewing')).toBe(true);
    expect(has('remember-described')).toBe(true);
    press('remember-hide');
    expect(has('remember-building')).toBe(true);
  });

  it('timed: hides after the chosen seconds; Show again shows it again', () => {
    press('remember-time-10');
    press('remember-start');
    act(() => jest.advanceTimersByTime(9_000));
    expect(has('remember-viewing')).toBe(true);
    act(() => jest.advanceTimersByTime(1_500));
    expect(has('remember-building')).toBe(true);
    press('remember-show-again');
    expect(has('remember-viewing')).toBe(true);
  });
});

describe('texts', () => {
  it('KG/RU/EN; no claim of measuring memory', () => {
    for (const lang of [en, ru, kg]) expect((lang as unknown as { rememberPattern: { practiceNote: string; levels: Record<string, string> } }).rememberPattern.levels.hard).toBeTruthy();
    expect(en.rememberPattern.practiceNote).toContain("doesn't measure memory");
  });
});
