import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MotifLayer } from '@/services/culture/oymoEditor';
import { CUSTOM_MOTIFS_KEY, ownerMotifs, useCustomMotifsStore } from '@/store/useCustomMotifsStore';

import { copySnapshot } from '../milestones/milestonesModel';
import { applyRemix, NO_CHANGE, toCreatorState } from '../remix/remixModel';
import { buildStencilPage, DEFAULT_SETTINGS } from '../stencil/stencilModel';
import { applyEdit, current, edit, embed, MAX_PRIMITIVES, newMotif, redo, startHistory, toGeometry, undo, validateEmbedded, validateMotif, validPrimitive, type CustomMotif } from './customMotifModel';

const line = { kind: 'line' as const, x1: 2, y1: 2, x2: 20, y2: 2 };
const circle = { kind: 'circle' as const, cx: 12, cy: 12, r: 4 };
const poly = { kind: 'polygon' as const, points: [[4, 20], [12, 6], [20, 20]] as [number, number][] };
const motif = (primitives = [line, circle, poly]): CustomMotif => ({ ...newMotif('Test'), id: 'cm-test-1', primitives });

describe('format validation', () => {
  it('accepts v1 primitives on the 0..24 integer grid', () => {
    for (const p of [line, circle, poly]) expect(validPrimitive(p)).toBe(true);
    expect(validateMotif(motif())).toMatchObject({ id: 'cm-test-1', v: 1, primitives: [line, circle, poly] });
  });
  it.each([
    ['off-grid', { ...line, x2: 25 }],
    ['fractional', { ...line, x1: 1.5 }],
    ['zero-length line', { ...line, x2: 2, y2: 2 }],
    ['radius 0', { ...circle, r: 0 }],
    ['radius too large', { ...circle, r: 13 }],
    ['2-point polygon', { kind: 'polygon', points: [[0, 0], [1, 1]] }],
    ['7-point polygon', { kind: 'polygon', points: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]] }],
    ['repeated corner', { kind: 'polygon', points: [[0, 0], [0, 0], [3, 3]] }],
    ['unknown kind', { kind: 'bezier' }],
  ])('rejects %s', (_label, primitive) => {
    expect(validPrimitive(primitive)).toBe(false);
  });
  it('unsupported versions / too many parts / empty fail gracefully (null), never throw', () => {
    expect(validateEmbedded({ v: 2, name: 'x', primitives: [line] })).toBeNull();
    expect(validateEmbedded({ v: 1, name: 'x', primitives: Array.from({ length: MAX_PRIMITIVES + 1 }, () => line) })).toBeNull();
    expect(validateEmbedded({ v: 1, name: 'x', primitives: [] })).toBeNull();
    expect(validateEmbedded('garbage')).toBeNull();
    expect(validateMotif({ ...motif(), format: 'other' })).toBeNull();
  });
});

describe('rendering inputs', () => {
  it('deterministic geometry in the built-in primitive format', () => {
    expect(toGeometry([line, circle, poly])).toEqual([
      { kind: 'path', d: 'M2 2L20 2', strokeWidth: 2, cap: 'round', join: 'round' },
      { kind: 'circle', cx: 12, cy: 12, r: 4, strokeWidth: 2 },
      { kind: 'path', d: 'M4 20L12 6L20 20Z', strokeWidth: 2, join: 'round' },
    ]);
    expect(toGeometry([line])).toEqual(toGeometry([line]));
  });
  it('the embedded copy is what the editor drew (preview and Creator share it)', () => {
    const m = motif();
    expect(toGeometry(validateEmbedded(embed(m))!.primitives)).toEqual(toGeometry(m.primitives));
  });
});

describe('editing and undo', () => {
  it('add / move / remove within bounds; out-of-grid moves are refused', () => {
    let m = applyEdit(motif([]), { type: 'add', primitive: line });
    m = applyEdit(m, { type: 'move', index: 0, dx: 1, dy: 3 });
    expect(m.primitives[0]).toEqual({ kind: 'line', x1: 3, y1: 5, x2: 21, y2: 5 });
    expect(applyEdit(m, { type: 'move', index: 0, dx: 5, dy: 0 })).toBe(m);
    expect(applyEdit(m, { type: 'remove', index: 0 }).primitives).toEqual([]);
  });
  it('undo restores the COMPLETE previous motif; redo goes forward', () => {
    let h = startHistory(motif([line]));
    h = edit(h, { type: 'add', primitive: circle });
    h = edit(h, { type: 'move', index: 0, dx: 0, dy: 4 });
    h = edit(h, { type: 'rename', name: 'Renamed' });
    const before = current(h);
    h = undo(undo(h));
    expect(current(h)).toEqual({ ...motif([line, circle]), name: 'Test' });
    expect(current(redo(redo(h)))).toEqual(before);
    expect(current(undo(undo(undo(h)))).primitives).toEqual([line]);
  });
  it('edits never mutate the previous snapshot', () => {
    const m = motif([poly]);
    const moved = applyEdit(m, { type: 'move', index: 0, dx: 1, dy: 0 });
    expect(m.primitives[0]).toEqual(poly);
    expect(moved.primitives[0]).not.toEqual(poly);
  });
});

describe('persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useCustomMotifsStore.setState({ status: 'idle', saved: {} });
    await useCustomMotifsStore.getState().load();
  });
  it('save -> reopen keeps the motif exactly, per owner', async () => {
    expect(await useCustomMotifsStore.getState().save('user-a', motif())).toBe(true);
    useCustomMotifsStore.setState({ status: 'idle', saved: {} });
    await useCustomMotifsStore.getState().load();
    expect(ownerMotifs(useCustomMotifsStore.getState().saved, 'user-a').map((m) => m.primitives)).toEqual([[line, circle, poly]]);
    expect(ownerMotifs(useCustomMotifsStore.getState().saved, 'user-b')).toEqual([]);
  });
  it('an invalid stored motif is skipped, others load; invalid saves are refused; failed writes report false', async () => {
    await AsyncStorage.setItem(CUSTOM_MOTIFS_KEY, JSON.stringify({ guest: { bad: { format: 'oyno.customMotif', v: 9, id: 'cm-bad-1' }, good: { ...motif(), id: 'cm-good-1' } } }));
    useCustomMotifsStore.setState({ status: 'idle', saved: {} });
    await useCustomMotifsStore.getState().load();
    expect(ownerMotifs(useCustomMotifsStore.getState().saved, 'guest').map((m) => m.id)).toEqual(['cm-good-1']);
    expect(await useCustomMotifsStore.getState().save('guest', { ...motif(), primitives: [{ ...line, x2: 99 }] })).toBe(false);
    const real = AsyncStorage.setItem;
    AsyncStorage.setItem = () => Promise.reject(new Error('disk'));
    try {
      expect(await useCustomMotifsStore.getState().save('guest', motif())).toBe(false);
    } finally {
      AsyncStorage.setItem = real;
    }
  });
});

describe('compatibility', () => {
  const customLayer: MotifLayer = { id: 'layer0', motifId: 'custom:cm-test-1', color: '#2F5233', point: { x: 150, y: 150 }, rotation: 0, scale: 1, visible: true, custom: embed(motif()) };
  const builtIn: MotifLayer = { id: 'layer1', motifId: 'gul', color: '#2F5233', point: { x: 60, y: 60 }, rotation: 0, scale: 1, visible: true };
  const design = { layers: [customLayer, builtIn], backgroundColor: '#EADCC0', symmetry: 'none' as const };
  it('remix copies, milestone snapshots and the Creator handoff keep the embedded motif', () => {
    expect(applyRemix(design, NO_CHANGE).layers[0].custom).toEqual(customLayer.custom);
    expect(copySnapshot(design).layers[0].custom).toEqual(customLayer.custom);
    expect(toCreatorState(design).state.layers[0].custom).toEqual(customLayer.custom);
  });
  it('Stencil outlines the custom motif from its own geometry; an invalid one is reported, not substituted', () => {
    const texts = { motifName: (id: string) => id, note: '' };
    const page = buildStencilPage({ layers: [customLayer], symmetry: 'none', name: null }, DEFAULT_SETTINGS, texts);
    expect(page.elements.map((e) => (e.kind === 'path' ? e.d : 'circle'))).toEqual(['M2 2L20 2', 'circle', 'M4 20L12 6L20 20Z']);
    const broken = buildStencilPage({ layers: [{ ...customLayer, custom: { v: 7, name: '', primitives: [] } }], symmetry: 'none', name: null }, DEFAULT_SETTINGS, texts);
    expect(broken.elements).toEqual([]);
    expect(broken.limitations).toContainEqual({ kind: 'unknownMotif', motifIds: ['custom:cm-test-1'] });
  });
  it('existing built-in layers have no custom field and are unaffected', () => {
    expect('custom' in builtIn).toBe(false);
    expect(applyRemix({ ...design, layers: [builtIn] }, NO_CHANGE).layers[0]).toEqual(builtIn);
  });
});
