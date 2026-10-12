import fs from 'fs';
import path from 'path';

import { applyQueueChange, MAX_ITEMS, type Queue } from '@/features/nextVisit/nextVisitModel';

import { designItems, groupByType, inRange, localDay, localMidnight, momentItems, noteItems, planTargets, presetRange, questionItems, rangeBounds, scrapbookItems, search, type OffsetAt } from './discoveryRecapModel';

const bishkek: OffsetAt = () => -360; // UTC+6
const newYork: OffsetAt = (ms) => (ms >= Date.UTC(2026, 2, 8, 7) && ms < Date.UTC(2026, 10, 1, 6) ? 240 : 300); // EDT/EST

const bookmark = (createdAt: string, change = {}) => ({ contentType: 'culture_item' as const, contentId: 'boz-uy-overview', sectionKey: 'history', articleTitle: 'Боз үй', sectionLabel: 'History', note: 'my note', createdAt, updatedAt: createdAt, ...change });

describe('adapters (explicit saves, their own timestamps)', () => {
  it('maps each source; personal words kept; only articles/activities are plannable', () => {
    const notes = noteItems([bookmark('2026-10-05T10:00:00Z')]);
    expect(notes[0]).toMatchObject({ type: 'note', at: '2026-10-05T10:00:00Z', personal: 'my note', plan: { kind: 'article', id: 'boz-uy-overview' } });
    const q = questionItems([{ id: 'q1', text: 'Why?', origin: { articleId: 'a1', sectionKey: 'origin', articleTitle: 'A', sectionLabel: 'Origin' }, supports: [], answer: '', status: 'exploring', createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z', answeredAt: null }]);
    expect(q[0]).toMatchObject({ type: 'question', personal: 'Why?', plan: { kind: 'article', id: 'a1' } });
    const m = momentItems([{ id: 'mabc', trackId: 'ak-maral-min', seconds: 12.4, titleSnapshot: 'Ак марал', note: '', createdAt: '2026-10-07T00:00:00Z', updatedAt: '' }]);
    expect(m[0]).toMatchObject({ type: 'moment', personal: null, plan: { kind: 'activity', id: 'komuzListen' } });
    expect(m[0].route).toBe('/culture/komuz/listen?resumeTrack=ak-maral-min&at=12');
    const d = designItems([{ id: 'd1', name: 'Mine', layers: [], background_color: '#fff', symmetry_mode: 'none', created_at: '2026-10-08T00:00:00Z', updated_at: '' } as never]);
    expect(d[0]).toMatchObject({ type: 'design', plan: null });
    expect(scrapbookItems([{ id: 'sb1', title: 'Book', entries: [], createdAt: '2026-10-09T00:00:00Z', updatedAt: '' }])[0].type).toBe('scrapbook');
  });
  it('records without a valid save timestamp are left out (never dated by guess)', () => {
    expect(noteItems([bookmark('')])).toEqual([]);
    expect(noteItems([bookmark('not a date')])).toEqual([]);
  });
  it('capsules are not a recap source, and nothing is sent to analytics', () => {
    const dir = __dirname;
    for (const file of fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src).not.toMatch(/from '[^']*(analytics|useCapsuleStore)[^']*'|\btrack\(|capsuleItems/);
    }
  });
});

describe('date boundaries (device local time)', () => {
  it('a day runs from local midnight to the next local midnight (UTC+6)', () => {
    expect(new Date(localMidnight('2026-10-05', bishkek)!).toISOString()).toBe('2026-10-04T18:00:00.000Z');
    const b = rangeBounds('2026-10-05', '2026-10-05', bishkek)!;
    const items = noteItems([bookmark('2026-10-04T17:59:59.999Z'), bookmark('2026-10-04T18:00:00.000Z', { sectionKey: 'a' }), bookmark('2026-10-05T17:59:59.999Z', { sectionKey: 'b' }), bookmark('2026-10-05T18:00:00.000Z', { sectionKey: 'c' })]);
    expect(inRange(items, b).map((i) => i.at)).toEqual(['2026-10-05T17:59:59.999Z', '2026-10-04T18:00:00.000Z']);
  });
  it('DST: the day of the autumn change is 25 hours long in New York', () => {
    const b = rangeBounds('2026-11-01', '2026-11-01', newYork)!;
    expect((b.end - b.start) / 3_600_000).toBe(25);
    expect(new Date(b.start).toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });
  it('invalid or reversed ranges are rejected', () => {
    expect(rangeBounds('2026-02-30', '2026-03-01', bishkek)).toBeNull();
    expect(rangeBounds('2026-10-10', '2026-10-01', bishkek)).toBeNull();
    expect(rangeBounds('10/10/2026', '2026-10-11', bishkek)).toBeNull();
  });
  it('presets use the local date, both ends included', () => {
    const now = Date.UTC(2026, 9, 11, 20, 0); // 02:00 on 12 Oct in Bishkek
    expect(localDay(now, bishkek)).toBe('2026-10-12');
    expect(presetRange('last7', now, bishkek)).toEqual({ from: '2026-10-06', to: '2026-10-12' });
    expect(presetRange('thisMonth', now, bishkek)).toEqual({ from: '2026-10-01', to: '2026-10-12' });
    expect(presetRange('last30', now, bishkek).from).toBe('2026-09-13');
  });
});

describe('search, grouping, ownership-safe inputs', () => {
  const items = [...noteItems([bookmark('2026-10-05T10:00:00Z', { note: 'Tunduk detail' })]), ...questionItems([{ id: 'q1', text: 'Why round?', origin: null, supports: [], answer: '', status: 'exploring', createdAt: '2026-10-06T00:00:00Z', updatedAt: '', answeredAt: null }])];
  it('searches titles and the person’s own words only', () => {
    expect(search(items, 'tunduk').map((i) => i.type)).toEqual(['note']);
    expect(search(items, 'ROUND').map((i) => i.type)).toEqual(['question']);
    expect(search(items, 'boz-uy-overview')).toEqual([]); // ids are not searched
  });
  it('groups by type in a fixed order', () => {
    expect(groupByType(items).map((g) => [g.type, g.items.length])).toEqual([['note', 1], ['question', 1], ['moment', 0], ['design', 0], ['scrapbook', 0]]);
  });
});

describe('adding to My Next Visit', () => {
  it('distinct supported targets only; unsupported counted', () => {
    const items = [...noteItems([bookmark('2026-10-05T10:00:00Z'), bookmark('2026-10-05T11:00:00Z', { sectionKey: 'origin' })]), ...designItems([{ id: 'd1', name: 'X', layers: [], background_color: '#fff', symmetry_mode: 'none', created_at: '2026-10-08T00:00:00Z', updated_at: '' } as never])];
    const result = planTargets(items, items.map((i) => i.key));
    expect(result.supported).toEqual([{ kind: 'article', id: 'boz-uy-overview', title: 'Боз үй' }]);
    expect(result.unsupported).toBe(1);
  });
  it('the plan limit holds: the queue never exceeds five', () => {
    let queue: Queue = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) queue = applyQueueChange(queue, { type: 'add', item: { kind: 'article', id, titleSnapshot: id }, now: 'T' });
    expect(queue).toHaveLength(MAX_ITEMS);
  });
});
