import { Vibrate, Volume2, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { GamePreferences } from '@/store/useSettingsStore';

import { SettingsRow, SettingsSection } from './components/SettingsRow';
import { SettingsScreenLayout } from './components/SettingsScreenLayout';

/** Only the preferences the games actually read (GameAudioManager checks
 * soundEffects, gameHaptics checks haptics). There is no game music to
 * switch off, so no Music toggle. */
const ROWS: { id: 'soundEffects' | 'haptics'; icon: LucideIcon }[] = [
  { id: 'soundEffects', icon: Volume2 },
  { id: 'haptics', icon: Vibrate },
];

type GameSettingsScreenProps = {
  preferences: GamePreferences;
  onChange: (id: keyof GamePreferences, value: boolean) => void;
  onPressBack: () => void;
};

export function GameSettingsScreen({ preferences, onChange, onPressBack }: GameSettingsScreenProps) {
  const { t } = useTranslation();
  return (
    <SettingsScreenLayout title={t('settings.game.title')} onPressBack={onPressBack}>
      <SettingsSection>
        {ROWS.map(({ id, icon }) => (
          <SettingsRow key={id} icon={icon} label={t(`settings.game.${id}`)} toggle={{ value: preferences[id], onChange: (value) => onChange(id, value) }} />
        ))}
      </SettingsSection>
    </SettingsScreenLayout>
  );
}
