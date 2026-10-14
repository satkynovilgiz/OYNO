import { useWindowDimensions } from 'react-native';

export const TABLET_BREAKPOINT = 768;

/** Drives the phone-vs-tablet layout collapse for the Boz Üy Builder and
 * Oymo Creator (both spec'd against a tablet/desktop-width 3-column
 * reference that needs to fold into a single scrolling column on phone
 * width). No existing breakpoint helper in the codebase to reuse. */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

/** Wide windows (desktop web, large tablets in landscape). */
export const WIDE_BREAKPOINT = 1200;
export type LayoutClass = 'phone' | 'tablet' | 'wide';
export const layoutClassFor = (width: number): LayoutClass => (width >= WIDE_BREAKPOINT ? 'wide' : width >= TABLET_BREAKPOINT ? 'tablet' : 'phone');
/** The ONE responsive breakpoint helper: phone < 768 <= tablet < 1200 <= wide. */
export function useLayoutClass(): LayoutClass {
  const { width } = useWindowDimensions();
  return layoutClassFor(width);
}
