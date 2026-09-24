import { ALL_HOME_SECTIONS, getHomeSectionOrder } from './homeSections';

const AGES = ['child', 'preteen', 'teen', 'adult'] as const;

describe('Home information hierarchy', () => {
  it.each(AGES)('%s: header area answers "what next / explore / today" first, in that order', (experience) => {
    expect(getHomeSectionOrder(experience).slice(0, 3)).toEqual(['hero', 'culture', 'today']);
  });

  it.each(AGES)('%s: every section appears at most once and is a real section', (experience) => {
    const order = getHomeSectionOrder(experience);
    expect(new Set(order).size).toBe(order.length);
    for (const id of order) expect(ALL_HOME_SECTIONS).toContain(id);
  });

  it('children see fewer sections (no secondary recent row)', () => {
    expect(getHomeSectionOrder('child')).not.toContain('recent');
    expect(getHomeSectionOrder('child').length).toBeLessThan(getHomeSectionOrder('adult').length);
  });

  it('preteens see progress before games; adults keep rewards last', () => {
    const preteen = getHomeSectionOrder('preteen');
    expect(preteen.indexOf('progress')).toBeLessThan(preteen.indexOf('games'));
    expect(getHomeSectionOrder('adult').at(-1)).toBe('dailyRow');
  });
});
