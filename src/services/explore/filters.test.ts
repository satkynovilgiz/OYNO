import { filterRegions, type FilterableRegion } from './filters';

const regions: FilterableRegion[] = [
  { id: 'bishkek', kind: 'region' },
  { id: 'osh', kind: 'region' },
  { id: 'son-kol', kind: 'nature' },
  { id: 'alay', kind: 'nature' },
];

describe('filterRegions', () => {
  it('returns everything when no filters are active', () => {
    expect(filterRegions(regions, [], [])).toEqual(regions);
  });

  it('restricts to region-kind rows only', () => {
    expect(filterRegions(regions, ['regions'], []).map((r) => r.id)).toEqual(['bishkek', 'osh']);
  });

  it('restricts to nature-kind rows only', () => {
    expect(filterRegions(regions, ['nature'], []).map((r) => r.id)).toEqual(['son-kol', 'alay']);
  });

  it('restricts to visited (discovered) rows only', () => {
    expect(filterRegions(regions, ['discovered'], ['bishkek', 'alay']).map((r) => r.id)).toEqual(['bishkek', 'alay']);
  });

  it('restricts to unvisited (undiscovered) rows only', () => {
    expect(filterRegions(regions, ['undiscovered'], ['bishkek']).map((r) => r.id)).toEqual(['osh', 'son-kol', 'alay']);
  });

  it('combines a kind filter and a state filter with AND', () => {
    expect(filterRegions(regions, ['regions', 'discovered'], ['bishkek', 'alay']).map((r) => r.id)).toEqual(['bishkek']);
  });
});
