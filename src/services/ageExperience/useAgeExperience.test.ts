/**
 * No @testing-library/react-native in this project (checked - not a
 * dependency), so this drives the hook through a tiny react-test-renderer
 * harness instead of adding a new test dependency for one hook.
 */
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';

import { useAppStore } from '@/store/useAppStore';

import { AGE_EXPERIENCE_CONFIG } from './config';
import { useAgeExperience, type UseAgeExperienceResult } from './useAgeExperience';

jest.mock('@/services/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({ insert: jest.fn(() => Promise.resolve({ error: null })) })),
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn(() => ({ status: 'guest', user: null })) },
}));

function renderAgeExperience(): { current: UseAgeExperienceResult } {
  const ref: { current: UseAgeExperienceResult | null } = { current: null };
  function Probe() {
    ref.current = useAgeExperience();
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  return ref as { current: UseAgeExperienceResult };
}

describe('useAgeExperience', () => {
  beforeEach(() => {
    useAppStore.setState({ ageGroup: null, hasChosenAgeGroup: false });
  });

  it('defaults to the adult experience before a choice has been made', () => {
    const result = renderAgeExperience();

    expect(result.current.ageGroup).toBe('18+');
    expect(result.current.experience).toBe('adult');
    expect(result.current.hasChosenAgeGroup).toBe(false);
    expect(result.current.config).toEqual(AGE_EXPERIENCE_CONFIG.adult);
  });

  it('reflects a chosen age group', () => {
    useAppStore.setState({ ageGroup: '6-9', hasChosenAgeGroup: true });

    const result = renderAgeExperience();

    expect(result.current.ageGroup).toBe('6-9');
    expect(result.current.experience).toBe('child');
    expect(result.current.hasChosenAgeGroup).toBe(true);
    expect(result.current.config).toEqual(AGE_EXPERIENCE_CONFIG.child);
  });

  it.each([
    ['10-13', 'preteen'],
    ['14-17', 'teen'],
    ['18+', 'adult'],
  ] as const)('maps age group %s to experience %s', (ageGroup, experience) => {
    useAppStore.setState({ ageGroup, hasChosenAgeGroup: true });

    const result = renderAgeExperience();

    expect(result.current.experience).toBe(experience);
    expect(result.current.config).toEqual(AGE_EXPERIENCE_CONFIG[experience]);
  });
});
