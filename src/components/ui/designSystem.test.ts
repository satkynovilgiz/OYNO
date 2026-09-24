import { cardRadii, motion, spacing, textStyles } from '@/theme';

import { railItemWidth } from './Rail';

describe('design system v2 tokens', () => {
  it('press feedback stays in the 100-150 ms window and never exceeds a subtle squeeze', () => {
    for (const preset of [motion.pressSoft, motion.pressStrong]) {
      expect(preset.inMs).toBeGreaterThanOrEqual(100);
      expect(preset.outMs).toBeLessThanOrEqual(150);
      expect(preset.scale).toBeGreaterThanOrEqual(0.95);
    }
    expect(motion.pressSoft.scale).toBe(0.985);
  });

  it('radius ladder grows chip < compact < media < hero', () => {
    expect(cardRadii.chip).toBeLessThan(cardRadii.compact);
    expect(cardRadii.compact).toBeLessThan(cardRadii.media);
    expect(cardRadii.media).toBeLessThan(cardRadii.hero);
  });

  it('type scale is strictly ordered and every style has a line height', () => {
    const order = ['display', 'h1', 'h2', 'h3', 'title', 'body', 'caption', 'small', 'overline'] as const;
    for (let i = 1; i < order.length; i++) expect(textStyles[order[i]].fontSize).toBeLessThanOrEqual(textStyles[order[i - 1]].fontSize);
    for (const key of order) expect(textStyles[key].lineHeight).toBeGreaterThan(textStyles[key].fontSize);
  });
});

describe('Rail item widths', () => {
  it.each([375, 390, 393, 430])('%ipt: medium cards are ~70%% of content width so the next one peeks', (screen) => {
    const content = screen - spacing.md * 2;
    const width = railItemWidth(screen, 'medium');
    expect(width / content).toBeGreaterThan(0.64);
    expect(width / content).toBeLessThan(0.73);
    expect(width + spacing.sm).toBeLessThan(content);
  });

  it.each([375, 390, 393, 430])('%ipt: compact tiles fit two readable tiles plus a peek', (screen) => {
    const content = screen - spacing.md * 2;
    const width = railItemWidth(screen, 'compact');
    expect(width * 2 + spacing.sm).toBeLessThan(content);
    expect(width).toBeGreaterThan(140);
  });
});
