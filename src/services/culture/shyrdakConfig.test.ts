import {
  DEFAULT_SHYRDAK_CONFIG,
  resetShyrdakConfig,
  setBaseColor,
  setPattern,
  setSecondaryColor,
  setSymmetryMode,
  toggleBorder,
} from './shyrdakConfig';

describe('shyrdakConfig setters', () => {
  it('setBaseColor updates only baseColor', () => {
    const next = setBaseColor(DEFAULT_SHYRDAK_CONFIG, '#123456');
    expect(next.baseColor).toBe('#123456');
    expect(next.secondaryColor).toBe(DEFAULT_SHYRDAK_CONFIG.secondaryColor);
  });

  it('setSecondaryColor updates only secondaryColor', () => {
    const next = setSecondaryColor(DEFAULT_SHYRDAK_CONFIG, '#654321');
    expect(next.secondaryColor).toBe('#654321');
    expect(next.baseColor).toBe(DEFAULT_SHYRDAK_CONFIG.baseColor);
  });

  it('setPattern updates only patternId', () => {
    const next = setPattern(DEFAULT_SHYRDAK_CONFIG, 'kushTyrmagy');
    expect(next.patternId).toBe('kushTyrmagy');
  });

  it('toggleBorder flips borderEnabled', () => {
    const off = toggleBorder(DEFAULT_SHYRDAK_CONFIG);
    expect(off.borderEnabled).toBe(!DEFAULT_SHYRDAK_CONFIG.borderEnabled);
    const backOn = toggleBorder(off);
    expect(backOn.borderEnabled).toBe(DEFAULT_SHYRDAK_CONFIG.borderEnabled);
  });

  it('setSymmetryMode updates only symmetryMode', () => {
    const next = setSymmetryMode(DEFAULT_SHYRDAK_CONFIG, 'none');
    expect(next.symmetryMode).toBe('none');
  });

  it('resetShyrdakConfig returns the default config', () => {
    expect(resetShyrdakConfig()).toEqual(DEFAULT_SHYRDAK_CONFIG);
  });
});
