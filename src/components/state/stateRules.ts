/**
 * One vocabulary for screen states (docs/SCREEN_STATES.md):
 *
 *   loading      the data is on its way (a skeleton of the coming layout, or a
 *                labelled indicator - and after SLOW_AFTER_MS it says so and
 *                offers Try again: never an endless spinner)
 *   ready        show the content
 *   empty        loaded fine, nothing there yet (says what to do next)
 *   notFound     loaded fine, this record / item does not exist
 *   unavailable  can't be shown here and now for a known reason (offline and
 *                not downloaded, signed out) - says what would make it work
 *   error        loading failed - says so and offers Try again; never shown
 *                as "not found" and never as "empty"
 *
 * Order matters: a failure is only an error when there is nothing to show;
 * already loaded content stays visible and the failed part gets its own
 * inline message (SectionError).
 */
export type ScreenState = 'loading' | 'ready' | 'empty' | 'notFound' | 'unavailable' | 'error';

export const SLOW_AFTER_MS = 8000;

export type StateInputs = {
  loading: boolean;
  failed: boolean;
  /** Known reason this can't load now (offline + not downloaded, signed out). */
  unavailable?: boolean;
  /** Loaded, but the asked-for record isn't there. */
  missing?: boolean;
  /** Loaded, but there is nothing to list. */
  empty?: boolean;
  /** Something is already on screen (cached or partly loaded). */
  hasContent?: boolean;
};

export function resolveScreenState(input: StateInputs): ScreenState {
  if (input.hasContent && !input.missing) return input.empty ? 'empty' : 'ready';
  if (input.unavailable) return 'unavailable';
  if (input.failed) return 'error';
  if (input.loading) return 'loading';
  if (input.missing) return 'notFound';
  if (input.empty) return 'empty';
  return 'ready';
}

/** A store's `status` (createSerialQueue stores: idle / loading / ready / error) as inputs. */
export function storeInputs(status: 'idle' | 'loading' | 'ready' | 'error'): Pick<StateInputs, 'loading' | 'failed'> {
  return { loading: status === 'idle' || status === 'loading', failed: status === 'error' };
}
