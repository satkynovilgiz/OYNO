import { router } from 'expo-router';

import { SettingsExperienceScreen } from '@/features/settings/SettingsExperienceScreen';
import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsExperienceRoute() {
  const { ageGroup } = useAgeExperience();
  const setAgeGroup = useAppStore((state) => state.setAgeGroup);

  return (
    <SettingsExperienceScreen selected={ageGroup} onSelect={setAgeGroup} onPressBack={() => router.back()} />
  );
}
