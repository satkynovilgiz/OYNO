import type { MotifLayer, OymoEditorState } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';

/**
 * Pattern Recipe - how a pattern was built, step by step. Each step is a
 * COMPLETE replay state (layers + background + symmetry), so stepping to
 * any point shows exactly that stage and the last step IS the final design.
 * Steps come from the Creator's own undo history (every supported edit,
 * now including symmetry changes), never from a second editor.
 */
export const MAX_RECIPE_STEPS = 100;
export const MAX_RECIPE_BYTES = 60_000;

export type StepLabel = 'start' | 'copy' | 'load' | 'place' | 'remove' | 'duplicate' | 'rotate' | 'scale' | 'reorder' | 'visibility' | 'background' | 'symmetry';
export const STEP_LABELS: StepLabel[] = ['start', 'copy', 'load', 'place', 'remove', 'duplicate', 'rotate', 'scale', 'reorder', 'visibility', 'background', 'symmetry'];

export type ReplayState = { layers: MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode };
export type RecipeStep = { label: StepLabel; motifId?: string; state: ReplayState };
/** `trimmed`: how many earlier steps were left out to fit the limits (the first kept step is then the starting point). */
export type Recipe = { steps: RecipeStep[]; trimmed: number };

/** One Creator history entry: the editor state, the symmetry in force, and what produced it. */
export type HistoryEntry = { state: OymoEditorState; symmetry: SymmetryMode; label: StepLabel; motifId?: string };

const copyLayers = (layers: readonly MotifLayer[]): MotifLayer[] => layers.map((layer) => ({ ...layer, point: { ...layer.point } }));

/** The recipe of the history up to the current undo position (redo steps are not part of the design). */
export function recipeFromHistory(history: readonly HistoryEntry[], index: number): Recipe {
  const steps = history.slice(0, index + 1).map((entry) => ({
    label: entry.label,
    ...(entry.motifId ? { motifId: entry.motifId } : {}),
    state: { layers: copyLayers(entry.state.layers), backgroundColor: entry.state.backgroundColor, symmetry: entry.symmetry },
  }));
  return { steps, trimmed: 0 };
}

export const recipeBytes = (recipe: Recipe) => JSON.stringify(recipe).length;

/**
 * Fits a recipe into the limits by leaving out the EARLIEST steps: the
 * final design is always kept, and the first kept step becomes the
 * starting point. `trimmed` says how many were left out.
 */
export function fitRecipe(recipe: Recipe, maxSteps = MAX_RECIPE_STEPS, maxBytes = MAX_RECIPE_BYTES): Recipe {
  let steps = recipe.steps.slice(-maxSteps);
  let trimmed = recipe.trimmed + (recipe.steps.length - steps.length);
  while (steps.length > 1 && recipeBytes({ steps, trimmed }) > maxBytes) {
    steps = steps.slice(1);
    trimmed += 1;
  }
  return { steps, trimmed };
}

export const finalState = (recipe: Recipe): ReplayState | null => recipe.steps[recipe.steps.length - 1]?.state ?? null;

/** A stage as a brand-new, unsaved Creator design (deep copy, no link to any saved creation). */
export function stageAsCopy(recipe: Recipe, index: number): { state: OymoEditorState; symmetry: SymmetryMode } | null {
  const step = recipe.steps[index];
  if (!step) return null;
  const layers = copyLayers(step.state.layers);
  const nextId = layers.reduce((max, layer) => Math.max(max, (Number(String(layer.id).replace(/\D/g, '')) || 0) + 1), layers.length);
  return { state: { layers, backgroundColor: step.state.backgroundColor, nextId }, symmetry: step.state.symmetry };
}

/** Same content -> same fingerprint (the saved creation row doesn't return its id, so recipes are matched by content). */
export function fingerprint(content: { layers: readonly MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode }): string {
  const canonical = JSON.stringify({
    l: content.layers.map((layer) => [layer.id, layer.motifId, layer.color, Math.round(layer.point.x * 100) / 100, Math.round(layer.point.y * 100) / 100, layer.rotation, Math.round(layer.scale * 1000) / 1000, layer.visible]),
    b: content.backgroundColor,
    s: content.symmetry,
  });
  let hash = 5381;
  for (let index = 0; index < canonical.length; index += 1) hash = ((hash * 33) ^ canonical.charCodeAt(index)) >>> 0;
  return `${hash.toString(36)}-${canonical.length.toString(36)}`;
}

/** Re-checks a stored recipe (older or tampered data never breaks the player). */
export function normalizeRecipe(raw: unknown): Recipe | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Partial<Recipe>;
  if (!Array.isArray(value.steps) || value.steps.length === 0) return null;
  const steps: RecipeStep[] = [];
  for (const step of value.steps.slice(-MAX_RECIPE_STEPS)) {
    if (!step || typeof step !== 'object' || !STEP_LABELS.includes(step.label) || !step.state || !Array.isArray(step.state.layers) || typeof step.state.backgroundColor !== 'string' || !['none', 'mirror', 'fourWay'].includes(step.state.symmetry)) return null;
    steps.push({ label: step.label, ...(typeof step.motifId === 'string' ? { motifId: step.motifId } : {}), state: { layers: copyLayers(step.state.layers), backgroundColor: step.state.backgroundColor, symmetry: step.state.symmetry } });
  }
  return { steps, trimmed: Number.isInteger(value.trimmed) && (value.trimmed as number) >= 0 ? (value.trimmed as number) : 0 };
}

/** The unsaved session's recipe handed to the player (memory only). */
let session: Recipe | null = null;
export const setSessionRecipe = (recipe: Recipe | null) => {
  session = recipe ? JSON.parse(JSON.stringify(recipe)) : null;
};
export const sessionRecipe = () => session;
