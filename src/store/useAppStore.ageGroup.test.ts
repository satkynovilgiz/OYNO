/**
 * Covers the age-group slice of useAppStore only (spec "Add Age Experience
 * controls to Settings... Add tests for changing groups and persistence").
 * Mocks Supabase purely because setAgeGroup fires an analytics `track()`
 * call - the age group itself is local-only (AsyncStorage), same pattern
 * as hasChosenLanguage/hasCompletedOnboarding.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from './useAppStore';

jest.mock('@/services/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({ insert: jest.fn(() => Promise.resolve({ error: null })) })),
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn(() => ({ status: 'guest', user: null })) },
}));

const AGE_GROUP_KEY = 'oyno.ageGroup';

beforeEach(async () => {
  await AsyncStorage.clear();
  useAppStore.setState({ ageGroup: null, hasChosenAgeGroup: false });
});

describe('useAppStore age group', () => {
  it('starts with no age group chosen', () => {
    expect(useAppStore.getState().ageGroup).toBeNull();
    expect(useAppStore.getState().hasChosenAgeGroup).toBe(false);
  });

  it('setAgeGroup persists the choice and updates state', async () => {
    await useAppStore.getState().setAgeGroup('10-13');

    expect(useAppStore.getState().ageGroup).toBe('10-13');
    expect(useAppStore.getState().hasChosenAgeGroup).toBe(true);
    expect(await AsyncStorage.getItem(AGE_GROUP_KEY)).toBe('10-13');
  });

  it('loadAgeGroup restores a previously persisted choice', async () => {
    await AsyncStorage.setItem(AGE_GROUP_KEY, '14-17');

    await useAppStore.getState().loadAgeGroup();

    expect(useAppStore.getState().ageGroup).toBe('14-17');
    expect(useAppStore.getState().hasChosenAgeGroup).toBe(true);
  });

  it('loadAgeGroup leaves the group unset when nothing was ever chosen', async () => {
    await useAppStore.getState().loadAgeGroup();

    expect(useAppStore.getState().ageGroup).toBeNull();
    expect(useAppStore.getState().hasChosenAgeGroup).toBe(false);
  });

  it('loadAgeGroup ignores a corrupted/unrecognized stored value', async () => {
    await AsyncStorage.setItem(AGE_GROUP_KEY, 'not-a-real-group');

    await useAppStore.getState().loadAgeGroup();

    expect(useAppStore.getState().ageGroup).toBeNull();
    expect(useAppStore.getState().hasChosenAgeGroup).toBe(false);
  });

  it('changing groups later (Settings > Experience) overwrites the previous choice', async () => {
    await useAppStore.getState().setAgeGroup('6-9');
    expect(useAppStore.getState().ageGroup).toBe('6-9');

    await useAppStore.getState().setAgeGroup('18+');

    expect(useAppStore.getState().ageGroup).toBe('18+');
    expect(await AsyncStorage.getItem(AGE_GROUP_KEY)).toBe('18+');
  });
});
