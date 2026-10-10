/** Pattern Detective: generation (exact counts, real changes), matching, explanations, deep copies. */
import { takeCreatorHandoff, handOffToCreator } from '@/services/culture/oymoHandoff';

import { applyChanges, assisted, attemptReducer, BASE_COLOR, CHANGED_CELLS, cellRows, cellsOf, check, diffCells, generateChallenge, LEVELS, seeded, startAttempt, toCreatorCopy, type Challenge } from './detectiveModel';
import { cellKey } from './playgroundModel';
import { REMEMBER_PATTERNS } from './rememberModel';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const many = (level: (typeof LEVELS)[number], count = 300) => Array.from({ length: count }, (_, index) => generateChallenge(level, seeded(index + 1)));

describe('generation', () => {
  it.each(LEVELS)('%s: exactly the advertised number of changed cells, every one really different', (level) => {
    for (const challenge of many(level)) {
      expect(challenge.changed).toHaveLength(CHANGED_CELLS[level]);
      // The tracked cells ARE the cells whose drawn content differs (model comparison, no pixels).
      expect(diffCells(challenge.original, challenge.modified)).toEqual(challenge.changed);
      // Applying the tracked changes again reproduces the modified pattern.
      expect(applyChanges(challenge.original, challenge.changes)).toEqual(challenge.modified);
      // One motif per cell in both versions.
      for (const grid of [challenge.original, challenge.modified]) expect(new Set(grid.map((mark) => cellKey(mark.cell))).size).toBe(grid.length);
    }
  });

  it('starts from a valid authored pattern, untouched', () => {
    for (const challenge of many('hard', 50)) {
      const pattern = REMEMBER_PATTERNS.find((entry) => entry.id === challenge.patternId)!;
      expect(challenge.original.map((mark) => [cellKey(mark.cell), mark.motifId, mark.color])).toEqual(pattern.marks.map((mark) => [cellKey(mark.cell), mark.motifId, BASE_COLOR]));
    }
  });

  it('uses every supported kind of change; a move changes both of its cells', () => {
    const kinds = new Set<string>();
    for (const level of LEVELS) for (const challenge of many(level)) for (const change of challenge.changes) {
      kinds.add(change.kind);
      if (change.kind === 'move') {
        expect(challenge.changed).toEqual(expect.arrayContaining([cellKey(change.from), cellKey(change.to)]));
        expect(challenge.modified.some((mark) => cellKey(mark.cell) === cellKey(change.from))).toBe(false);
        expect(challenge.modified.find((mark) => cellKey(mark.cell) === cellKey(change.to))).toMatchObject(change.before);
      }
    }
    expect([...kinds].sort()).toEqual(['add', 'move', 'recolor', 'remove', 'replace']);
  });

  it('the explanation covers every changed cell, once', () => {
    for (const challenge of many('hard', 100)) expect(challenge.changes.flatMap(cellsOf).map(cellKey).sort()).toEqual(challenge.changed);
  });
});

describe('matching and assistance', () => {
  const challenge: Challenge = generateChallenge('medium', seeded(42));
  it('wrong, then corrected, then solved; hints mark the attempt assisted', () => {
    const wrongCell = ['0,0', '1,0', '2,0', '3,0', '4,0', '0,1'].find((key) => !challenge.changed.includes(key))!;
    let state = attemptReducer(startAttempt(challenge), { type: 'toggle', key: wrongCell });
    state = attemptReducer(state, { type: 'toggle', key: challenge.changed[0] });
    state = attemptReducer(state, { type: 'check' });
    expect(state.feedback).toEqual({ found: 1, missed: 1, extra: 1, solved: false });
    expect(state.done).toBe(false);
    state = attemptReducer(state, { type: 'hint' });
    expect(state.hints).toEqual([challenge.changed[1]]);
    expect(assisted(state)).toBe(true);
    state = attemptReducer(attemptReducer(state, { type: 'toggle', key: wrongCell }), { type: 'toggle', key: challenge.changed[1] });
    state = attemptReducer(state, { type: 'check' });
    expect(state).toMatchObject({ done: true, checks: 2, feedback: { solved: true } });
    // Finished: marks can't change any more; restart clears everything.
    expect(attemptReducer(state, { type: 'toggle', key: '4,4' })).toBe(state);
    expect(attemptReducer(state, { type: 'restart' })).toEqual(startAttempt(challenge));
    expect(check(challenge, [])).toEqual({ found: 0, missed: 2, extra: 0, solved: false });
  });

  it('the list shows each drawn cell with its original and modified content', () => {
    for (const row of cellRows(challenge)) {
      const key = row.key;
      const differs = JSON.stringify(row.original) !== JSON.stringify(row.modified);
      expect(differs).toBe(challenge.changed.includes(key));
    }
  });
});

describe('copies', () => {
  it('playing and opening a copy never change the original or the challenge', () => {
    const challenge = generateChallenge('hard', seeded(7));
    const before = JSON.stringify(challenge);
    const copy = toCreatorCopy(challenge.modified);
    copy.layers[0].color = '#000000';
    copy.layers[0].point.x = 1;
    handOffToCreator(toCreatorCopy(challenge.original), { source: 'detective' });
    const handed = takeCreatorHandoff()!;
    handed.state.layers.forEach((layer) => (layer.motifId = 'changed'));
    applyChanges(challenge.original, challenge.changes)[0].cell.col = 9;
    expect(JSON.stringify(challenge)).toBe(before);
    expect(handed.source).toBe('detective');
    expect(handed.state.layers).toHaveLength(challenge.original.length);
  });
});
