import * as fs from 'fs';
import * as path from 'path';

import { ageGroupLabel, APPEARANCE_SECTIONS, buildSettingsSections, enabledReminderCount, languageLabel, versionLabel } from './settingsModel';

const rows = (sections: ReturnType<typeof buildSettingsSections>) => sections.flatMap((section) => section.rows);

describe('Settings landing', () => {
  it('gives guests no account-only rows and no admin row', () => {
    const guest = rows(buildSettingsSections('guest', true));
    expect(guest).not.toContain('security');
    expect(guest).not.toContain('admin');
  });

  it('gives signed-in users Security, and admins the admin row', () => {
    expect(rows(buildSettingsSections('signedIn', false))).toContain('security');
    expect(rows(buildSettingsSections('signedIn', true))).toContain('admin');
    expect(rows(buildSettingsSections('signedIn', false))).not.toContain('admin');
  });

  it('never shows the same row twice', () => {
    const all = rows(buildSettingsSections('signedIn', true));
    expect(new Set(all).size).toBe(all.length);
  });

  it('has a real route file for every row that navigates to settings/<id>', () => {
    for (const id of ['experience', 'language', 'reminders', 'game', 'privacy', 'security', 'help', 'about']) {
      expect(fs.existsSync(path.join(__dirname, '../../app/settings', `${id}.tsx`))).toBe(true);
    }
    expect(fs.existsSync(path.join(__dirname, '../../app/settings/data.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../../app/offline.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../../app/appearance/index.tsx'))).toBe(true);
  });
});

describe('Appearance', () => {
  it('contains Wallpapers and Widgets only - no app icons', () => {
    expect([...APPEARANCE_SECTIONS]).toEqual(['wallpapers', 'widgets']);
    expect(fs.readdirSync(path.join(__dirname, '../../app/appearance')).some((name) => /icon/i.test(name))).toBe(false);
  });
});

describe('value labels', () => {
  it('shows each language in its own name', () => {
    expect(languageLabel('kg')).toBe('Кыргызча');
    expect(languageLabel('ru')).toBe('Русский');
    expect(languageLabel('en')).toBe('English');
  });

  it('shows the chosen age range', () => {
    expect(ageGroupLabel('14-17')).toBe('14–17');
    expect(ageGroupLabel('18+')).toBe('18+');
    expect(ageGroupLabel(null)).toBe('');
  });

  it('counts enabled reminders and formats the version', () => {
    expect(enabledReminderCount({ dailyEnabled: true, journeyEnabled: false, trailEnabled: true })).toBe(2);
    expect(versionLabel('1.0.0', '12')).toBe('1.0.0 (12)');
    expect(versionLabel('1.0.0', null)).toBe('1.0.0');
  });
});

describe('Settings copy', () => {
  it('uses translation keys that exist in every language', () => {
    const src = fs.readFileSync(path.join(__dirname, 'SettingsScreen.tsx'), 'utf8');
    const keys = Array.from(src.matchAll(/t\('([a-zA-Z0-9_.]+)'/g)).map((m) => m[1]);
    for (const lang of ['kg', 'ru', 'en']) {
      const dict = JSON.parse(fs.readFileSync(path.join(__dirname, `../../i18n/locales/${lang}.json`), 'utf8'));
      for (const key of keys) {
        const value = key.split('.').reduce((o: Record<string, unknown> | undefined, part) => (o?.[part] as Record<string, unknown> | undefined), dict);
        expect({ lang, key, found: value !== undefined }).toEqual({ lang, key, found: true });
      }
    }
  });
});
