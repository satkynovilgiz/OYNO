import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { fingerprint, fitRecipe, normalizeRecipe, type Recipe } from '@/features/culture/oymo/recipe/recipeModel';
import type { MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { safeJsonParse } from '@/services/storage/safeJson';

/**
 * Saved Pattern Recipes, on this device, per OWNER and per saved CREATION
 * ID - so two identical creations have independent recipes, deleting one
 * removes only its own, and a creation saved without a recipe never
 * inherits another's.
 *
 * v1 (2026-10-08, one day) keyed recipes by content fingerprint. Those are
 * kept as `legacy` and adopted only when EXACTLY ONE of the owner's saved
 * creations has that content (`adoptLegacy`); an ambiguous one (0 or 2+
 * matches) stays unassigned and is never shown, rather than being copied
 * onto several creations.
 */
export const OYMO_RECIPES_KEY = 'oyno.oymoRecipes.v2';
export const LEGACY_RECIPES_KEY = 'oyno.oymoRecipes.v1';

type Entry = { recipe: Recipe; savedAt: string };
type OwnerRecipes = { byCreation: Record<string, Entry>; legacy: Record<string, Entry> };
type Saved = Record<string, OwnerRecipes>;
type CreationContent = { id: string; layers: readonly MotifLayer[]; background_color: string; symmetry_mode: SymmetryMode };

const EMPTY: OwnerRecipes = { byCreation: {}, legacy: {} };
const ID = /^[A-Za-z0-9-]{1,64}$/;

function entries(raw: unknown): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, entry] of Object.entries(raw as Record<string, { recipe?: unknown; savedAt?: unknown }>)) {
    const recipe = normalizeRecipe(entry?.recipe);
    if (recipe && ID.test(key)) out[key] = { recipe, savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : '' };
  }
  return out;
}

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  /** The recipe of ONE saved creation (by its id). */
  saveRecipe: (owner: string, creationId: string, recipe: Recipe) => void;
  /** Removes that creation's recipe only. */
  removeFor: (owner: string, creationId: string) => void;
  /** Moves v1 fingerprint recipes onto creations where exactly one creation matches. */
  adoptLegacy: (owner: string, creations: readonly CreationContent[]) => void;
};

export const useOymoRecipeStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(OYMO_RECIPES_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  const mine = (owner: string) => get().saved[owner] ?? EMPTY;
  const put = (owner: string, next: OwnerRecipes) => {
    set({ saved: { ...get().saved, [owner]: next } });
    persist();
  };
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const [raw, legacyRaw] = await Promise.all([AsyncStorage.getItem(OYMO_RECIPES_KEY).catch(() => null), AsyncStorage.getItem(LEGACY_RECIPES_KEY).catch(() => null)]);
      if (get().isLoaded) return;
      const saved: Saved = {};
      const parsed = safeJsonParse<unknown>(raw, {});
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [owner, value] of Object.entries(parsed as Record<string, Partial<OwnerRecipes>>)) {
          if (!value || typeof value !== 'object') continue;
          saved[owner] = { byCreation: entries(value.byCreation), legacy: entries(value.legacy) };
        }
      }
      // v1 -> legacy (fingerprint keys); never overwrites what v2 already has.
      const legacy = safeJsonParse<unknown>(legacyRaw, {});
      if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
        for (const [owner, byPrint] of Object.entries(legacy as Record<string, unknown>)) {
          const found = entries(byPrint);
          if (Object.keys(found).length === 0) continue;
          const current = saved[owner] ?? { byCreation: {}, legacy: {} };
          saved[owner] = { ...current, legacy: { ...found, ...current.legacy } };
        }
      }
      set({ saved, isLoaded: true });
      if (legacyRaw !== null) {
        // Remove v1 only once v2 is durably written; a failed write keeps v1 for the next launch.
        try {
          await AsyncStorage.setItem(OYMO_RECIPES_KEY, JSON.stringify(get().saved));
        } catch {
          return;
        }
        await AsyncStorage.removeItem(LEGACY_RECIPES_KEY).catch(() => undefined);
      }
    },
    saveRecipe: (owner, creationId, recipe) => {
      if (!ID.test(creationId)) return;
      const current = mine(owner);
      put(owner, { ...current, byCreation: { ...current.byCreation, [creationId]: { recipe: fitRecipe(recipe), savedAt: new Date().toISOString() } } });
    },
    removeFor: (owner, creationId) => {
      const current = mine(owner);
      if (!current.byCreation[creationId]) return;
      const byCreation = { ...current.byCreation };
      delete byCreation[creationId];
      put(owner, { ...current, byCreation });
    },
    adoptLegacy: (owner, creations) => {
      // Before storage has loaded there is nothing to adopt yet - callers retry once `isLoaded` flips.
      if (!get().isLoaded) return;
      const current = mine(owner);
      const prints = Object.keys(current.legacy);
      if (prints.length === 0) return;
      const byCreation = { ...current.byCreation };
      const legacy = { ...current.legacy };
      let changed = false;
      for (const print of prints) {
        const matches = creations.filter((creation) => fingerprint({ layers: creation.layers, backgroundColor: creation.background_color, symmetry: creation.symmetry_mode }) === print);
        if (matches.length !== 1 || byCreation[matches[0].id]) continue; // ambiguous or already has one: leave it
        byCreation[matches[0].id] = legacy[print];
        delete legacy[print];
        changed = true;
      }
      if (changed) put(owner, { byCreation, legacy });
    },
  };
});

/** The recipe saved with THIS creation by this owner, or null (older creations, other accounts, other creations). */
export function recipeFor(saved: Saved, owner: string, creationId: string | null | undefined): Recipe | null {
  return creationId ? (saved[owner]?.byCreation[creationId]?.recipe ?? null) : null;
}
