import { computeCollectionProgress, type CollectionProgressSignals } from './collectionProgress';
import { collections, getCollection } from './collectionsData';

const none: CollectionProgressSignals = {
  completionFlags: { bozUyVisited: false, oymoCreated: false, shyrdakCreated: false, komuzLessonCompleted: false },
  gameStats: {},
};

describe('computeCollectionProgress', () => {
  it('only counts content with a real completion signal', () => {
    const horse = computeCollectionProgress(getCollection('horse-culture')!, none);
    // 7 culture items are untracked; the 2 games are trackable
    expect(horse).toMatchObject({ completed: 0, total: 2, status: 'unstarted' });
    const bozUy = computeCollectionProgress(getCollection('boz-uy-world')!, none);
    expect(bozUy).toMatchObject({ total: 1, status: 'unstarted' });
    const ornament = computeCollectionProgress(getCollection('kyrgyz-ornament')!, none);
    expect(ornament).toMatchObject({ total: 2, status: 'unstarted' });
  });

  it('reads 3D game stats by their recorded progress id', () => {
    const horse = computeCollectionProgress(getCollection('horse-culture')!, { ...none, gameStats: { kok_boru: { played: 1, won: 0 } } });
    expect(horse).toMatchObject({ completed: 1, total: 2, status: 'inProgress' });
    expect(horse.stateOf({ kind: 'game', id: 'kok-boru' })).toBe('completed');
    expect(horse.stateOf({ kind: 'game', id: 'kyz-kuumay' })).toBe('untouched');
    expect(horse.stateOf({ kind: 'culture_item', id: 'horse-eer' })).toBe('untracked');
  });

  it('is completed only when every trackable item is done', () => {
    const signals = { ...none, completionFlags: { ...none.completionFlags, oymoCreated: true, shyrdakCreated: true } };
    expect(computeCollectionProgress(getCollection('kyrgyz-ornament')!, signals).status).toBe('completed');
  });

  it('every existing collection has at least one trackable item', () => {
    for (const collection of collections) {
      expect(computeCollectionProgress(collection, none).total).toBeGreaterThan(0);
    }
  });
});
