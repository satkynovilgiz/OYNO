import * as fs from 'fs';
import * as path from 'path';

import { contrastRatio } from '@/services/comfort/comfort';

import { colors } from './colors';
import { cardRadii } from './radii';
import { spacing } from './spacing';
import { cardPadding, cards, controlStates, headings, layout, overlays, text } from './ui';

const ROOT = path.join(__dirname, '../..');
const AA = 4.5;

describe('UI conventions - heading hierarchy', () => {
  it('display > screen > section > card > body, every level with a line height', () => {
    const order = [headings.display, headings.screen, headings.section, headings.card, text.body, text.meta, text.fine];
    for (let i = 1; i < order.length; i++) expect(order[i].fontSize).toBeLessThan(order[i - 1].fontSize);
    for (const style of order) expect(style.lineHeight).toBeGreaterThan(style.fontSize);
    expect(text.reading.fontSize).toBeGreaterThan(text.body.fontSize);
  });
});

describe('UI conventions - cards and rhythm use existing tokens only', () => {
  it('card padding/radius come from the spacing and radius ladders', () => {
    const spacings = Object.values(spacing) as number[];
    const radii = Object.values(cardRadii) as number[];
    for (const card of Object.values(cards)) {
      expect(spacings).toContain(card.padding);
      expect(radii).toContain(card.borderRadius);
    }
    expect(cardPadding.compact).toBeLessThan(cardPadding.standard);
    expect(cardPadding.standard).toBeLessThan(cardPadding.feature);
    expect(layout.sectionGap).toBeGreaterThan(layout.stackGap);
    expect(layout.stackGap).toBeGreaterThan(layout.cardGap);
  });
});

describe('UI conventions - contrast (WCAG AA 4.5:1 for text)', () => {
  it('every enabled and selected control state is readable, pressed included', () => {
    for (const tone of ['primary', 'accent', 'secondary', 'ghost', 'text', 'destructive'] as const) {
      const state = controlStates[tone];
      const surface = state.bg === 'transparent' ? colors.background : state.bg;
      expect([tone, contrastRatio(state.fg, surface) >= AA]).toEqual([tone, true]);
      const pressed = state.pressedBg;
      expect([`${tone} pressed`, contrastRatio(state.fg, pressed) >= AA]).toEqual([`${tone} pressed`, true]);
    }
    expect(contrastRatio(controlStates.selected.fg, controlStates.selected.bg)).toBeGreaterThanOrEqual(AA);
  });

  it('disabled is visibly different from enabled but still legible (>= 3:1)', () => {
    expect(controlStates.disabled.bg).not.toBe(controlStates.primary.bg);
    expect(contrastRatio(controlStates.disabled.fg, controlStates.disabled.bg)).toBeGreaterThanOrEqual(3);
  });

  it('text roles on the surfaces they are used on', () => {
    const pairs: [string, string, string][] = [
      ['textPrimary/background', colors.textPrimary, colors.background],
      ['textSecondary/background', colors.textSecondary, colors.background],
      ['textSecondary/surfaceAlt', colors.textSecondary, colors.surfaceAlt],
      ['textMuted/background', colors.textMuted, colors.background],
      ['textMuted/surface', colors.textMuted, colors.surface],
      ['terracottaText/surface', colors.accentTerracottaText, colors.surface],
      ['goldText/background', colors.accentGoldText, colors.background],
      ['onDark/feature', colors.textOnDark, colors.surfaceFeature],
      ['onDark/terracottaDark', colors.textOnDark, colors.accentTerracottaDark],
      ['dangerText/surfaceAlt', colors.dangerText, colors.surfaceAlt],
      ['dangerText/background', colors.dangerText, colors.background],
    ];
    for (const [name, fg, bg] of pairs) expect([name, contrastRatio(fg, bg) >= AA]).toEqual([name, true]);
  });

  it('overlays are the forest scrim family (no pure black)', () => {
    for (const value of Object.values(overlays)) expect(value).not.toMatch(/rgba\(0,\s*0,\s*0/);
  });
});

describe('UI conventions - representative screens are migrated', () => {
  const MIGRATED = [
    'src/features/home/primary/HomePrimary.tsx',
    'src/features/home/primary/CreateHubScreen.tsx',
    'src/features/home/components/HomeTodayPair.tsx',
    'src/features/home/components/HomeProgressSection.tsx',
    'src/features/home/components/ContinueRegionCard.tsx',
    'src/features/home/components/RecentlyExploredRow.tsx',
    'src/features/culture/CultureItemDetailScreen.tsx',
    'src/features/culture/oymo/OymoCreatorScreen.tsx',
    'src/features/profile/ProfileScreen.tsx',
  ];
  it.each(MIGRATED)('%s: no literal font sizes, legacy typography or raw colours', (file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(source).not.toMatch(/fontSize: \d/);
    expect(source).not.toMatch(/\btypography\./);
    expect(source).not.toMatch(/'#[0-9A-Fa-f]{3,8}'|'rgba\(/);
  });

  it('shared controls take their state colours from the one table', () => {
    for (const file of ['src/components/ui/Button.tsx', 'src/components/ui/IconButton.tsx', 'src/components/ui/Chip.tsx']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source).toContain('controlStates');
      expect(source).not.toMatch(/opacity: 0\.4/);
    }
  });
});
