import type { SupportedLanguage } from '@/i18n';
import type { AgeGroup } from '@/services/ageExperience/types';

/**
 * The Settings landing, as data - which sections exist and which rows they
 * hold for a given account state. Pure so it can be tested: guests never see
 * account-only rows, signed-in users get Manage account + Sign out, admins
 * get the admin row, and nothing here is a control that doesn't do anything.
 */
export type SettingsRowId =
  | 'experience'
  | 'language'
  | 'appearance'
  | 'reminders'
  | 'offline'
  | 'game'
  | 'privacy'
  | 'security'
  | 'storage'
  | 'help'
  | 'report'
  | 'about'
  | 'admin';

export type SettingsSectionId = 'experience' | 'personalization' | 'content' | 'privacy' | 'support' | 'about' | 'admin';

export type AccountState = 'guest' | 'signedIn';

export function buildSettingsSections(account: AccountState, isAdmin: boolean): { id: SettingsSectionId; rows: SettingsRowId[] }[] {
  const sections: { id: SettingsSectionId; rows: SettingsRowId[] }[] = [
    { id: 'experience', rows: ['experience', 'language'] },
    { id: 'personalization', rows: ['appearance'] },
    { id: 'content', rows: ['reminders', 'offline', 'game'] },
    // Security (password) only exists for a real account.
    { id: 'privacy', rows: account === 'signedIn' ? ['privacy', 'security', 'storage'] : ['privacy', 'storage'] },
    { id: 'support', rows: ['help', 'report'] },
    { id: 'about', rows: ['about'] },
  ];
  if (isAdmin && account === 'signedIn') sections.push({ id: 'admin', rows: ['admin'] });
  return sections;
}

/** Appearance holds exactly these two things - no app icons, no themes. */
export const APPEARANCE_SECTIONS = ['wallpapers', 'widgets'] as const;

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = { kg: 'Кыргызча', ru: 'Русский', en: 'English' };

/** Each language is shown in its own name, whatever the UI language is. */
export function languageLabel(language: string): string {
  return LANGUAGE_NAMES[language as SupportedLanguage] ?? LANGUAGE_NAMES.kg;
}

/** "14–17" (en dash), "18+"; empty when no age group is chosen yet. */
export function ageGroupLabel(ageGroup: AgeGroup | null): string {
  return ageGroup ? ageGroup.replace('-', '–') : '';
}

export function enabledReminderCount(settings: { dailyEnabled: boolean; journeyEnabled: boolean; trailEnabled: boolean }): number {
  return [settings.dailyEnabled, settings.journeyEnabled, settings.trailEnabled].filter(Boolean).length;
}

/** "1.0.0 (12)" when a native build number is known, else "1.0.0". */
export function versionLabel(version: string | null | undefined, build: string | null | undefined): string {
  const v = version || '—';
  return build ? `${v} (${build})` : v;
}
