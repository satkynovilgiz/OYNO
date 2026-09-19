import { resolveContinueJourney, type InteractiveCompletionFlags } from './continueJourney';
import type { QuestStep } from '@/services/explore/questSteps';

const NONE_DONE: InteractiveCompletionFlags = {
  bozUyVisited: false,
  oymoCreated: false,
  shyrdakCreated: false,
  komuzLessonCompleted: false,
};

const ALL_DONE: InteractiveCompletionFlags = {
  bozUyVisited: true,
  oymoCreated: true,
  shyrdakCreated: true,
  komuzLessonCompleted: true,
};

const STEP: QuestStep = { id: 'step-1', questId: 'quest-1', stepOrder: 1, stepType: 'VISIT_LOCATION', targetId: 'issyk-kol' };

describe('resolveContinueJourney', () => {
  it('prioritizes an active quest with a real incomplete step', () => {
    const result = resolveContinueJourney(
      { title: 'Quest title', subtitle: 'Quest subtitle', current: 1, total: 5, completed: false },
      [STEP],
      [],
      () => null,
      NONE_DONE,
    );
    expect(result).toEqual({
      kind: 'quest',
      title: 'Quest title',
      subtitle: 'Quest subtitle',
      current: 1,
      total: 5,
      ctaRoute: '/explore/issyk-kol',
    });
  });

  it('never shows a completed quest as an active continuation', () => {
    const result = resolveContinueJourney(
      { title: 'Quest title', subtitle: 'Quest subtitle', current: 5, total: 5, completed: true },
      [STEP],
      ['step-1'],
      () => null,
      NONE_DONE,
    );
    expect(result?.kind).not.toBe('quest');
  });

  it('falls back to the first not-yet-tried interactive experience when there is no active quest', () => {
    const result = resolveContinueJourney(null, [], [], () => null, NONE_DONE);
    expect(result).toEqual({
      kind: 'discover',
      titleKey: 'culture.interactive.oymo',
      imageSource: expect.anything(),
      ctaRoute: '/culture/oymo/create',
    });
  });

  it('skips already-tried experiences to find the next untried one', () => {
    const result = resolveContinueJourney(null, [], [], () => null, { ...NONE_DONE, oymoCreated: true });
    expect(result?.kind).toBe('discover');
    expect((result as { titleKey: string }).titleKey).toBe('culture.interactive.bozUy');
  });

  it('returns null (not a fabricated card) once everything is genuinely done', () => {
    const result = resolveContinueJourney(
      { title: 'Quest title', subtitle: 'Quest subtitle', current: 5, total: 5, completed: true },
      [],
      [],
      () => null,
      ALL_DONE,
    );
    expect(result).toBeNull();
  });
});
