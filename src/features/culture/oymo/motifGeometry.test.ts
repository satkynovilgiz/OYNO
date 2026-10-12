import type { ReactElement } from 'react';

import { MOTIF_GEOMETRY, type MotifPrimitive } from './motifGeometry';
import { OYMO_MOTIFS } from './motifs';

/** Every primitive a shape component actually draws (it's a plain function of its props). */
function drawn(Shape: unknown): MotifPrimitive[] {
  const nameOf = (type: unknown) => (typeof type === 'string' ? type : ((type as { displayName?: string; name?: string }).displayName ?? (type as { name?: string }).name ?? ''));
  const out: MotifPrimitive[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const element = node as ReactElement<Record<string, unknown>>;
    const p = element.props;
    const name = nameOf(element.type);
    if (name === 'Path') out.push({ kind: 'path', d: p.d as string, strokeWidth: p.strokeWidth as number, ...(p.strokeLinecap ? { cap: p.strokeLinecap as 'round' } : {}), ...(p.strokeLinejoin ? { join: p.strokeLinejoin as 'round' } : {}) });
    if (name === 'Circle') out.push({ kind: 'circle', cx: p.cx as number, cy: p.cy as number, r: p.r as number, ...(p.fill && p.fill !== 'none' ? { filled: true as const } : { strokeWidth: p.strokeWidth as number }) });
    walk(p?.children);
  };
  walk((Shape as (props: object) => ReactElement)({ size: 24, color: '#000' }));
  return out;
}

describe('motif geometry table', () => {
  it('covers every motif and nothing else', () => {
    expect(Object.keys(MOTIF_GEOMETRY).sort()).toEqual(OYMO_MOTIFS.map((motif) => motif.id).sort());
  });
  it.each(OYMO_MOTIFS.map((motif) => [motif.id, motif.Shape] as const))('%s matches what its shape component draws', (id, Shape) => {
    expect(drawn(Shape)).toEqual(MOTIF_GEOMETRY[id]);
  });
});
