import { collections, getCollection } from './collectionsData';

describe('collections', () => {
  it('has at least 3 collections, each with a unique id', () => {
    expect(collections.length).toBeGreaterThanOrEqual(3);
    const ids = collections.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every collection has a non-empty title/intro in all 3 locales and at least one section', () => {
    for (const collection of collections) {
      for (const locale of ['kg', 'ru', 'en'] as const) {
        expect(collection.title[locale].length).toBeGreaterThan(0);
        expect(collection.intro[locale].length).toBeGreaterThan(0);
      }
      expect(collection.sections.length).toBeGreaterThan(0);
      expect(collection.relatedCategoryId.length).toBeGreaterThan(0);
    }
  });

  it('never repeats the same (kind, id) content reference within one collection', () => {
    for (const collection of collections) {
      const keys = collection.sections.map((ref) => `${ref.kind}:${ref.id}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('getCollection', () => {
  it('finds a collection by id', () => {
    expect(getCollection(collections[0].id)?.id).toBe(collections[0].id);
  });

  it('returns undefined for an unknown id', () => {
    expect(getCollection('not-a-real-collection')).toBeUndefined();
  });
});
