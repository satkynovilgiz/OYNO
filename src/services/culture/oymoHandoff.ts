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
/** `name`: an optional suggested design name for the Creator's Save (never a person's name unless they typed it as the design name). */
export type CreatorHandoff = { state: OymoEditorState; symmetry: SymmetryMode; source: 'restore' | 'symmetry' | 'recipe' | 'remember' | 'remix' | 'detective' | 'border' | 'together' | 'colorLab' | 'milestone'; name?: string };
let pending: CreatorHandoff | null = null;

export function handOffToCreator(state: OymoEditorState, options: { symmetry?: SymmetryMode; source?: CreatorHandoff['source']; name?: string } = {}): void {
  pending = { state: JSON.parse(JSON.stringify(state)) as OymoEditorState, symmetry: options.symmetry ?? 'none', source: options.source ?? 'restore', ...(options.name?.trim() ? { name: options.name.trim().slice(0, 60) } : {}) };
}

export function takeCreatorHandoff(): CreatorHandoff | null {
  const taken = pending;
  pending = null;
  return taken;
}
