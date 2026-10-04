import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';

import { CULTURE_REFLECTION_PROMPT, getPrompt, JOURNAL_PROMPTS, nextPrompt, PROMPT_CATEGORIES, promptsFor, shuffledOrder } from './journalPrompts';

jest.mock('@/services/supabase/client', () => ({ supabase: {} }));

const ROOT = path.join(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const lookup = (locale: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);

describe('Journal prompts - data', () => {
  it('a small curated set: 5 categories, unique ids, every age mode served in every category it can be', () => {
    expect(PROMPT_CATEGORIES).toEqual(['memory', 'culture', 'family', 'place', 'learning']);
    expect(JOURNAL_PROMPTS).toHaveLength(20);
    expect(new Set(JOURNAL_PROMPTS.map((prompt) => prompt.id)).size).toBe(JOURNAL_PROMPTS.length);
    for (const experience of ['child', 'preteen', 'teen', 'adult'] as const) for (const category of PROMPT_CATEGORIES) expect(promptsFor(experience, category).length).toBeGreaterThanOrEqual(2);
  });

  it('KG/RU/EN copy exists for every prompt and category', () => {
    for (const locale of [kg, ru, en]) {
      for (const prompt of JOURNAL_PROMPTS) expect(String(lookup(locale, prompt.textKey) ?? '').trim()).toBeTruthy();
      for (const category of PROMPT_CATEGORIES) expect(lookup(locale, `journalPrompts.categories.${category}`)).toBeTruthy();
      for (const key of ['needIdea', 'use', 'another', 'anotherHint', 'without', 'promptLabel', 'notSaved', 'writeToday']) expect(lookup(locale, `journalPrompts.${key}`)).toBeTruthy();
    }
  });

  it('no therapy / diagnosis / mood framing in any language', () => {
    const copy = JSON.stringify([kg, ru, en].map((locale) => lookup(locale, 'journalPrompts.items'))).toLowerCase();
    expect(copy).not.toMatch(/anxi|depress|therap|trauma|mood|feel sad|mental|тревог|депресс|терап|настроени|депрес|көңүл-күй/);
  });
});

describe('Journal prompts - selection', () => {
  it('age filtering', () => {
    const child = promptsFor('child').map((prompt) => prompt.id);
    expect(child).toContain('m-favorite-moment');
    expect(child).not.toContain('l-changed-mind');
    expect(promptsFor('adult').map((prompt) => prompt.id)).not.toContain('p-outside-today');
  });

  it('category filtering', () => {
    expect(promptsFor('teen', 'culture').every((prompt) => prompt.category === 'culture')).toBe(true);
    expect(promptsFor('teen', 'family').map((prompt) => prompt.id)).toEqual(['f-family-story', 'f-celebration', 'f-learned-from-elder']);
  });

  it('no immediate repeat, every prompt before any repeats, deterministic per seed', () => {
    const pool = promptsFor('adult');
    let current: string | null = null;
    const seen: string[] = [];
    for (let i = 0; i < pool.length; i += 1) {
      const next: { id: string } = nextPrompt(pool, current, '2026-10-04')!;
      expect(next.id).not.toBe(current);
      seen.push(next.id);
      current = next.id;
    }
    expect(new Set(seen).size).toBe(pool.length);
    expect(shuffledOrder(pool, '2026-10-04').map((prompt) => prompt.id)).toEqual(shuffledOrder(pool, '2026-10-04').map((prompt) => prompt.id));
    expect(nextPrompt([], null, 'x')).toBeNull();
    const model = read('src/features/journal/prompts/journalPrompts.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(model).not.toMatch(/Math\.random|fetch\(|supabase/);
  });

  it('unknown ids are rejected', () => {
    expect(getPrompt('l-surprise')?.category).toBe('learning');
    expect(getPrompt('<script>')).toBeNull();
    expect(getPrompt(null)).toBeNull();
  });
});

describe('Journal prompts - editor, privacy, offline', () => {
  const editor = read('src/features/journal/JournalEntryScreen.tsx');
  const sheet = read('src/features/journal/prompts/PromptSheet.tsx');
  const route = read('src/app/journal/new.tsx');

  it('Use Prompt opens the EXISTING editor with only the prompt id', () => {
    expect(sheet).toContain("router.push((promptId ? { pathname: '/journal/new', params: { prompt: promptId } } : '/journal/new') as never)");
    expect(route).toContain('const promptId = typeof prompt === \'string\' && getPrompt(prompt) ? prompt : null;');
    expect(route).toContain('promptId={promptId}');
  });

  it('the prompt is never written into the note or stored with the entry', () => {
    expect(editor).toContain('const [note, setNote] = useState(\'\');');
    expect(editor).not.toMatch(/setNote\([^)]*prompt/);
    const save = editor.slice(editor.indexOf('async function save()'), editor.indexOf('async function remove()'));
    expect(save).toContain('const draft = { title, note, date, photoUri, link };');
    expect(save).not.toMatch(/prompt/i);
    expect(read('src/features/journal/journalModel.ts')).not.toMatch(/promptId|prompt_id/);
  });

  it('analytics: only journal_prompt_opened and journal_prompt_used with prompt_id - never text, title or note', () => {
    for (const call of sheet.match(/track\([^)]*\)/g) ?? []) expect(call).toMatch(/^track\('journal_prompt_opened'\)$|^track\('journal_prompt_used', \{ prompt_id: promptId \}\)$/);
    expect(editor).not.toMatch(/track\(/);
  });

  it('offline: bundled data, no request; no automatic reminders', () => {
    for (const file of ['src/features/journal/prompts/journalPrompts.ts', 'src/features/journal/prompts/PromptSheet.tsx']) expect(read(file)).not.toMatch(/fetch\(|supabase|scheduleNotification|expo-notifications/);
  });

  it('accessibility: the prompt card reads as plain text; Another prompt is labelled with a hint', () => {
    expect(sheet).toContain('accessibilityLabel={`${t(`journalPrompts.categories.${current.category}`)}. ${t(current.textKey)}`}');
    expect(sheet).toContain("accessibilityHint={t('journalPrompts.anotherHint')}");
  });

  it('On This Day never pretends: the CTA appears only without a match, for someone who keeps a journal, not written today', () => {
    const card = read('src/features/journal/calendar/OnThisDayCard.tsx');
    expect(card).toContain("if (!onPressPrompt || live.length === 0 || live.some((entry) => entry.date === today)) return null;");
    expect(card).toContain("t('journalPrompts.writeToday')");
  });

  it('Culture "Add to Journal" offers a generic reflection prompt (no article claims)', () => {
    expect(getPrompt(CULTURE_REFLECTION_PROMPT)?.category).toBe('culture');
    expect(read('src/components/journal/AddToJournalButton.tsx')).toContain("type === 'culture_item' ? { prompt: CULTURE_REFLECTION_PROMPT } : {}");
  });
});
