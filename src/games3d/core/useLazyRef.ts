import { useRef, type MutableRefObject } from 'react';

/**
 * A ref whose initial value is created ONCE. `useRef(create())` evaluates
 * `create()` on every render and throws the result away after the first -
 * for the games' audio managers that was a new manager object per render.
 */
export function useLazyRef<T>(create: () => T): MutableRefObject<T> {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = create();
  return ref as MutableRefObject<T>;
}
