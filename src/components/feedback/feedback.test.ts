import * as fs from 'fs';
import * as path from 'path';

import en from '@/i18n/locales/en.json';
import kg from '@/i18n/locales/kg.json';
import ru from '@/i18n/locales/ru.json';
import { motion } from '@/theme';

import { begin, expire, INITIAL, SAVED_VISIBLE_MS, settle } from './saveFeedback';

const ROOT = path.join(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
function sources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!full.includes('games3d')) sources(full, out);
    } else if (/\.tsx?$/.test(name) && !name.includes('.test.')) out.push(full);
  }
  return out;
}

describe('save feedback follows the real result', () => {
  it('saving -> saved only on success; failed on failure; saved expires', () => {
    const one = begin(INITIAL);
    expect(one.state).toBe('saving');
    expect(settle(one, one.seq, true).state).toBe('saved');
    expect(settle(one, one.seq, false).state).toBe('failed');
    expect(expire(settle(one, one.seq, true), one.seq)).toEqual({ state: 'idle', seq: one.seq });
    // A failure is not cleared by the timer.
    expect(expire(settle(one, one.seq, false), one.seq).state).toBe('failed');
    expect(SAVED_VISIBLE_MS).toBeGreaterThanOrEqual(2000);
  });

  it('rapid attempts: an older result never overwrites a newer state (no stuck or wrong status)', () => {
    const first = begin(INITIAL);
    const second = begin(first);
    // The first (older) save finishes late with success: ignored while the second is saving.
    expect(settle(second, first.seq, true)).toBe(second);
    const failed = settle(second, second.seq, false);
    expect(failed.state).toBe('failed');
    expect(settle(failed, first.seq, true)).toBe(failed);
    // An old "saved" timer can't clear a newer status.
    const third = begin(failed);
    expect(expire(third, second.seq)).toBe(third);
  });
});

describe('shared motion and haptics conventions', () => {
  it('no plain-tap haptics anywhere in the app UI; explicit ones fire on press, not press-in', () => {
    const offenders = sources(path.join(ROOT, 'src'))
      .filter((file) => !file.includes(`${path.sep}games3d${path.sep}`))
      .filter((file) => /haptic=["{]/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
    const pressable = read('src/components/ui/AnimatedPressable.tsx');
    const pressIn = pressable.slice(pressable.indexOf('onPressIn={(event) => {'), pressable.indexOf('onPress={'));
    expect(pressIn).not.toMatch(/haptic/);
    expect(read('src/components/ui/Button.tsx')).not.toMatch(/haptic=/);
  });

  it('save confirmations use one notification haptic (Comfort setting applies); the status never takes focus', () => {
    const status = read('src/components/feedback/SaveStatus.tsx');
    expect(status).toMatch(/hapticNotify\(ok \? 'success' : 'error'\)/);
    expect(status).toMatch(/pointerEvents="none"/);
    expect(status).not.toMatch(/autoFocus|\.focus\(\)/);
    expect(status).toMatch(/entering=\{reducedMotion \? undefined : FadeIn\.duration\(motion\.duration\.fast\)\}/);
    expect(read('src/services/comfort/haptics.ts')).toMatch(/hapticAllowed\(comfortPrefs\(\)\.haptics, 'notification'\)/);
  });

  it('timings come from the shared motion tokens and stay short (nothing delays navigation)', () => {
    expect(motion.duration.fast).toBeLessThanOrEqual(200);
    const offenders = sources(path.join(ROOT, 'src')).filter((file) => /setTimeout\([^)]*router\.(push|replace)/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it('KG / RU / EN', () => {
    for (const dict of [en, ru, kg]) {
      const block = (dict as unknown as { feedbackStates: Record<string, string> }).feedbackStates;
      for (const key of ['saving', 'saved', 'failed']) expect(block[key]?.trim()).toBeTruthy();
    }
  });
});
