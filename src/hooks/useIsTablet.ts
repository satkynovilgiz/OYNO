import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

/** Drives the phone-vs-tablet layout collapse for the Boz Üy Builder and
 * Oymo Creator (both spec'd against a tablet/desktop-width 3-column
 * reference that needs to fold into a single scrolling column on phone
 * width). No existing breakpoint helper in the codebase to reuse. */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}
