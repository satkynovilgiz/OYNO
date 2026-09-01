import { computeMirroredPoints, type Point, type SymmetryMode } from './symmetry';

export type { SymmetryMode, Point } from './symmetry';
export { computeMirroredPoints } from './symmetry';

/**
 * Oymo Creator V2: a real layer stack (V1's Phase 1 flat "one placement per
 * mirrored copy" model is gone). Each layer stores only its ORIGINAL
 * (pre-mirror) point - mirrored render points are recomputed fresh from
 * the current symmetry mode every render (computeMirroredPoints), not
 * baked in at placement time. That's what makes changing symmetry mode
 * re-mirror every existing layer instantly, and makes select/delete act on
 * the whole motif rather than one mirrored copy of it.
 *
 * Rotation is uniform across a layer's mirrored copies, not
 * mirror-reflected per copy - true kaleidoscopic rotation would rotate
 * each copy by a reflected angle, which is real geometry work for
 * marginal visible benefit at this motif scale (see the V2 plan).
 */
export type MotifLayer = {
  id: string;
  motifId: string;
  color: string;
  point: Point;
  rotation: number;
  scale: number;
  visible: boolean;
};

export type OymoEditorState = {
  layers: MotifLayer[];
  backgroundColor: string;
  nextId: number;
};

const DEFAULT_BACKGROUND = '#EADCC0';

export const EMPTY_OYMO_STATE: OymoEditorState = { layers: [], backgroundColor: DEFAULT_BACKGROUND, nextId: 0 };

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const ROTATION_STEP = 15;
const SCALE_STEP = 0.15;

export function addLayer(state: OymoEditorState, point: Point, motifId: string, color: string): OymoEditorState {
  const layer: MotifLayer = { id: `layer${state.nextId}`, motifId, color, point, rotation: 0, scale: 1, visible: true };
  return { ...state, layers: [...state.layers, layer], nextId: state.nextId + 1 };
}

export function removeLayer(state: OymoEditorState, layerId: string): OymoEditorState {
  return { ...state, layers: state.layers.filter((l) => l.id !== layerId) };
}

export function duplicateLayer(state: OymoEditorState, layerId: string): OymoEditorState {
  const source = state.layers.find((l) => l.id === layerId);
  if (!source) return state;
  const copy: MotifLayer = { ...source, id: `layer${state.nextId}`, point: { x: source.point.x + 12, y: source.point.y + 12 } };
  return { ...state, layers: [...state.layers, copy], nextId: state.nextId + 1 };
}

export function rotateLayer(state: OymoEditorState, layerId: string, deltaDeg: number = ROTATION_STEP): OymoEditorState {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === layerId ? { ...l, rotation: (l.rotation + deltaDeg + 360) % 360 } : l)),
  };
}

export function scaleLayer(state: OymoEditorState, layerId: string, deltaScale: number = SCALE_STEP): OymoEditorState {
  return {
    ...state,
    layers: state.layers.map((l) =>
      l.id === layerId ? { ...l, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, roundScale(l.scale + deltaScale))) } : l,
    ),
  };
}

function roundScale(scale: number): number {
  return Math.round(scale * 100) / 100;
}

export function reorderLayer(state: OymoEditorState, layerId: string, direction: 'up' | 'down'): OymoEditorState {
  const index = state.layers.findIndex((l) => l.id === layerId);
  if (index === -1) return state;
  const targetIndex = direction === 'up' ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= state.layers.length) return state;

  const layers = [...state.layers];
  [layers[index], layers[targetIndex]] = [layers[targetIndex], layers[index]];
  return { ...state, layers };
}

export function toggleLayerVisibility(state: OymoEditorState, layerId: string): OymoEditorState {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
  };
}

export function setBackgroundColor(state: OymoEditorState, color: string): OymoEditorState {
  return { ...state, backgroundColor: color };
}

export function resetCanvas(): OymoEditorState {
  return EMPTY_OYMO_STATE;
}

/** A visible layer's mirrored render points for the current symmetry mode. */
export function getLayerRenderPoints(layer: MotifLayer, symmetryMode: SymmetryMode, canvasSize: number): Point[] {
  return computeMirroredPoints(layer.point, symmetryMode, canvasSize);
}
