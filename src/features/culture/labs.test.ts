/**
 * Culture Labs: stable completion signals (the four server flags - what
 * Guided Quests, Collections and Journey read), rewards granted once,
 * reset, account-scoped creations, share privacy and real routes.
 */
import * as fs from 'fs';
import * as path from 'path';

import { isInteractiveExperienceCompleted } from '@/features/home/continueJourney';
import { USER_SCOPED_QUERY_ROOTS } from '@/services/auth/userScopedCache';
import { addLayer, EMPTY_OYMO_STATE, resetCanvas } from '@/services/culture/oymoEditor';

import { INTERACTIVE_EXPERIENCES, INTERACTIVE_EXPERIENCE_ROUTES } from './interactiveExperiences';

jest.mock('@/services/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));

const ROOT = path.join(__dirname, '../../..');
const LABS = ['oymo', 'boz-uy', 'shyrdak', 'komuz'] as const;
const NO_FLAGS = { bozUyVisited: false, oymoCreated: false, shyrdakCreated: false, komuzLessonCompleted: false };

describe('Culture Labs', () => {
  it('every lab has a real route file', () => {
    for (const lab of LABS) {
      const route = INTERACTIVE_EXPERIENCE_ROUTES[lab];
      expect(route).toBeTruthy();
      expect(fs.existsSync(path.join(ROOT, 'src/app', `${route}.tsx`))).toBe(true);
    }
    expect(INTERACTIVE_EXPERIENCES.map((entry) => entry.id).sort()).toEqual([...LABS].sort());
  });

  it('completion is one stable signal per lab (the server flag), used by quests and collections', () => {
    expect(isInteractiveExperienceCompleted('oymo', { ...NO_FLAGS, oymoCreated: true })).toBe(true);
    expect(isInteractiveExperienceCompleted('boz-uy', { ...NO_FLAGS, bozUyVisited: true })).toBe(true);
    expect(isInteractiveExperienceCompleted('shyrdak', { ...NO_FLAGS, shyrdakCreated: true })).toBe(true);
    expect(isInteractiveExperienceCompleted('komuz', { ...NO_FLAGS, komuzLessonCompleted: true })).toBe(true);
    for (const lab of LABS) expect(isInteractiveExperienceCompleted(lab, NO_FLAGS)).toBe(false);
  });

  it('rewards are granted once per account (no farming by reopening a lab)', () => {
    const sql = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).map((file) => fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8')).join('\n');
    for (const flag of ['oymo_created', 'shyrdak_created', 'komuz_lesson_completed', 'boz_uy_visited']) {
      expect(sql).toMatch(new RegExp(`if not v_row\\.${flag} then`));
    }
  });

  it('reset returns an empty canvas', () => {
    const drawn = addLayer(EMPTY_OYMO_STATE, { x: 10, y: 10 }, 'kochkor-muyuz', '#000000');
    expect(drawn.layers).toHaveLength(1);
    expect(resetCanvas().layers).toEqual([]);
  });

  it('saved creations are account-scoped (never shown to the next account)', () => {
    expect(USER_SCOPED_QUERY_ROOTS).toEqual(expect.arrayContaining(['oymo_creations', 'shyrdak_creation']));
  });

  it('a shared creation carries only the design, the lab name and OYNO branding', () => {
    for (const file of ['src/features/culture/oymo/OymoCreatorScreen.tsx', 'src/features/culture/shyrdak/ShyrdakCreatorScreen.tsx']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const start = source.indexOf('function handleShare');
      const shareCall = source.slice(start, source.indexOf("t('culture.labs.shareMessage')", start));
      expect(shareCall).toMatch(/variant: 'creation'/);
      expect(shareCall).not.toMatch(/user|email|account|name:/i);
    }
    const card = fs.readFileSync(path.join(ROOT, 'src/components/share/ShareCard.tsx'), 'utf8');
    const creationCard = card.slice(card.indexOf('const CreationCard'), card.indexOf('function Brand'));
    expect(creationCard).not.toMatch(/user|email|account/i);
  });
});
