import { resolveGameIntroPresentation } from './guideCharacterGating';

describe('resolveGameIntroPresentation', () => {
  it('child (primary) always gets the full intro, seen or not', () => {
    expect(resolveGameIntroPresentation('primary', false)).toBe('full');
    expect(resolveGameIntroPresentation('primary', true)).toBe('full');
  });

  it('preteen (frequent) gets the full intro the first time, then steps back', () => {
    expect(resolveGameIntroPresentation('frequent', false)).toBe('full');
    expect(resolveGameIntroPresentation('frequent', true)).toBe('skip');
  });

  it('teen (occasional) gets a condensed intro once, then nothing', () => {
    expect(resolveGameIntroPresentation('occasional', false)).toBe('condensed');
    expect(resolveGameIntroPresentation('occasional', true)).toBe('skip');
  });

  it('adult (subtle) still meets the guide once, condensed, never repeated', () => {
    expect(resolveGameIntroPresentation('subtle', false)).toBe('condensed');
    expect(resolveGameIntroPresentation('subtle', true)).toBe('skip');
  });
});
