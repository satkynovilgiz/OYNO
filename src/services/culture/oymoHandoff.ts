import type { OymoEditorState } from './oymoEditor';

/**
 * One composition handed to the Oymo Creator (e.g. a solved "Restore the
 * Pattern" puzzle). In memory only and taken ONCE: the Creator opens it as
 * a new, unsaved design - it is not linked to any saved creation, so
 * nothing already saved can be changed by it.
 */
let pending: OymoEditorState | null = null;

export function handOffToCreator(state: OymoEditorState): void {
  pending = JSON.parse(JSON.stringify(state)) as OymoEditorState;
}

export function takeCreatorHandoff(): OymoEditorState | null {
  const taken = pending;
  pending = null;
  return taken;
}
