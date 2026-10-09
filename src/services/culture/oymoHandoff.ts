import type { OymoEditorState } from './oymoEditor';
import type { SymmetryMode } from './symmetry';

/**
 * One composition handed to the Oymo Creator (a solved "Restore the
 * Pattern" puzzle, a Symmetry Playground design). In memory only and taken
 * ONCE: the Creator opens it as a new, unsaved design - it is not linked to
 * any saved creation, so nothing already saved can be changed by it.
 * `symmetry` is the mode the composition was made with (default: none -
 * the layers are already the whole design).
 */
export type CreatorHandoff = { state: OymoEditorState; symmetry: SymmetryMode; source: 'restore' | 'symmetry' | 'recipe' | 'remember' };
let pending: CreatorHandoff | null = null;

export function handOffToCreator(state: OymoEditorState, options: { symmetry?: SymmetryMode; source?: CreatorHandoff['source'] } = {}): void {
  pending = { state: JSON.parse(JSON.stringify(state)) as OymoEditorState, symmetry: options.symmetry ?? 'none', source: options.source ?? 'restore' };
}

export function takeCreatorHandoff(): CreatorHandoff | null {
  const taken = pending;
  pending = null;
  return taken;
}
