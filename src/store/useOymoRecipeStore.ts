import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { fingerprint, fitRecipe, normalizeRecipe, type Recipe } from '@/features/culture/oymo/recipe/recipeModel';
import type { MotifLayer } from '@/services/culture/oymoEditor';
import type { SymmetryMode } from '@/services/culture/symmetry';
import { safeJsonParse } from '@/services/storage/safeJson';

export const OYMO_RECIPES_KEY = 'oyno.oymoRecipes.v1';

/**
 * Saved Pattern Recipes, on this device, per OWNER (the account that saved
 * the creation - the same ownership as oymo_creations), keyed by the saved
 * creation's content fingerprint. Optional: creations saved without a
 * recipe (or before recipes existed) simply have none. Not synced: the
 * creations table has no recipe column, and adding one is a backend
 * migration this feature does not make.
 */
type Saved = Record<string, Record<string, { recipe: Recipe; savedAt: string }>>;
type CreationContent = { layers: readonly MotifLayer[]; backgroundColor: string; symmetry: SymmetryMode };

type State = {
  isLoaded: boolean;
  saved: Saved;
  load: () => Promise<void>;
  saveRecipe: (owner: string, content: CreationContent, recipe: Recipe) => void;
  removeFor: (owner: string, content: CreationContent) => void;
};

export const useOymoRecipeStore = create<State>((set, get) => {
  const persist = () => void AsyncStorage.setItem(OYMO_RECIPES_KEY, JSON.stringify(get().saved)).catch(() => undefined);
  return {
    isLoaded: false,
    saved: {},
    load: async () => {
      if (get().isLoaded) return;
      const raw = await AsyncStorage.getItem(OYMO_RECIPES_KEY).catch(() => null);
      if (get().isLoaded) return;
      const parsed = safeJsonParse<unknown>(raw, {});
      const saved: Saved = {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [owner, byPrint] of Object.entries(parsed as Record<string, unknown>)) {
          if (!byPrint || typeof byPrint !== 'object') continue;
          for (const [print, entry] of Object.entries(byPrint as Record<string, { recipe?: unknown; savedAt?: unknown }>)) {
            const recipe = normalizeRecipe(entry?.recipe);
            if (recipe) (saved[owner] ??= {})[print] = { recipe, savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : '' };
          }
        }
      }
      set({ saved, isLoaded: true });
    },
    saveRecipe: (owner, content, recipe) => {
      const fitted = fitRecipe(recipe);
      set({ saved: { ...get().saved, [owner]: { ...(get().saved[owner] ?? {}), [fingerprint(content)]: { recipe: fitted, savedAt: new Date().toISOString() } } } });
      persist();
    },
    removeFor: (owner, content) => {
      const mine = { ...(get().saved[owner] ?? {}) };
      delete mine[fingerprint(content)];
      set({ saved: { ...get().saved, [owner]: mine } });
      persist();
    },
  };
});

/** The recipe saved with this creation by this owner, or null (older creations, other accounts). */
export function recipeFor(saved: Saved, owner: string, content: CreationContent): Recipe | null {
  return saved[owner]?.[fingerprint(content)]?.recipe ?? null;
}
