import AsyncStorage from '@react-native-async-storage/async-storage';

import { LEARNING_PATH_KEY, useLearningPathStore } from './useLearningPathStore';

const fresh = () => useLearningPathStore.setState({ isLoaded: false, saved: {} });
const stored = async () => JSON.parse((await AsyncStorage.getItem(LEARNING_PATH_KEY)) ?? '{}');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
  fresh();
});

describe('manual step completions survive a tap before the store has loaded', () => {
  it('setManual before load keeps every earlier completion (this owner and others)', async () => {
    await AsyncStorage.setItem(
      LEARNING_PATH_KEY,
      JSON.stringify({ guest: { 'boz-uy': { build: '2026-10-01T00:00:00.000Z' } }, 'user-a': { 'felt-oymo': { 'lab-oymo': '2026-09-01T00:00:00.000Z' } } }),
    );
    // App restart: the screen is up, the store is not loaded yet, and the person taps.
    useLearningPathStore.getState().setManual('guest', 'felt-oymo', 'lab-shyrdak', true);
    await useLearningPathStore.getState().load();
    await flush();
    const expected = {
      guest: { 'boz-uy': { build: '2026-10-01T00:00:00.000Z' }, 'felt-oymo': { 'lab-shyrdak': expect.any(String) } },
      'user-a': { 'felt-oymo': { 'lab-oymo': '2026-09-01T00:00:00.000Z' } },
    };
    expect(useLearningPathStore.getState().saved).toEqual(expected);
    expect(await stored()).toEqual(expected);
  });
});

describe('load and writes', () => {
  it('concurrent loads read once and a change in between is kept', async () => {
    await AsyncStorage.setItem(LEARNING_PATH_KEY, JSON.stringify({ guest: { 'boz-uy': { build: '2026-10-01T00:00:00.000Z' } } }));
    const first = useLearningPathStore.getState().load();
    useLearningPathStore.getState().setManual('guest', 'felt-oymo', 'lab-shyrdak', true);
    const second = useLearningPathStore.getState().load();
    await Promise.all([first, second]);
    await flush();
    expect(Object.keys(useLearningPathStore.getState().saved.guest)).toEqual(['boz-uy', 'felt-oymo']);
  });

  it('confirming again keeps the first completion time (no duplicate, no reset)', async () => {
    await useLearningPathStore.getState().load();
    useLearningPathStore.getState().setManual('guest', 'boz-uy', 'build', true);
    const first = useLearningPathStore.getState().saved.guest['boz-uy'].build;
    await new Promise((resolve) => setTimeout(resolve, 5));
    useLearningPathStore.getState().setManual('guest', 'boz-uy', 'build', true);
    expect(useLearningPathStore.getState().saved.guest['boz-uy']).toEqual({ build: first });
  });

  it('a synced state that arrives before load replaces only that owner', async () => {
    await AsyncStorage.setItem(LEARNING_PATH_KEY, JSON.stringify({ guest: { 'boz-uy': { build: '2026-10-01T00:00:00.000Z' } } }));
    useLearningPathStore.getState().applySynced('user-a', { 'felt-oymo': { 'lab-oymo': '2026-09-01T00:00:00.000Z' } });
    await useLearningPathStore.getState().load();
    await flush();
    expect(await stored()).toEqual({ guest: { 'boz-uy': { build: '2026-10-01T00:00:00.000Z' } }, 'user-a': { 'felt-oymo': { 'lab-oymo': '2026-09-01T00:00:00.000Z' } } });
  });
});
