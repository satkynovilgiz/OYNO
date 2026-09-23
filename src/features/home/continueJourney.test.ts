import { isInteractiveExperienceCompleted, type InteractiveCompletionFlags } from './continueJourney';

const NONE_DONE: InteractiveCompletionFlags = { bozUyVisited: false, oymoCreated: false, shyrdakCreated: false, komuzLessonCompleted: false };

describe('isInteractiveExperienceCompleted', () => {
  it('reads each experience from its own real flag', () => {
    expect(isInteractiveExperienceCompleted('oymo', { ...NONE_DONE, oymoCreated: true })).toBe(true);
    expect(isInteractiveExperienceCompleted('boz-uy', { ...NONE_DONE, oymoCreated: true })).toBe(false);
    expect(isInteractiveExperienceCompleted('komuz', { ...NONE_DONE, komuzLessonCompleted: true })).toBe(true);
  });

  it('is false for unknown experiences', () => {
    expect(isInteractiveExperienceCompleted('unknown', { bozUyVisited: true, oymoCreated: true, shyrdakCreated: true, komuzLessonCompleted: true })).toBe(false);
  });
});
