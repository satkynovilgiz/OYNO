import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Speak a short status change to screen readers (VoiceOver, TalkBack, web
 * readers). react-native-web's AccessibilityInfo.announceForAccessibility
 * is a no-op, so on web the message goes into ONE persistent, visually
 * hidden polite live region - it must already exist before its text
 * changes, or readers ignore it.
 */
let region: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const LIVE_REGION_ID = 'oyno-live-region';

function webRegion(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (region && document.body.contains(region)) return region;
  region = document.getElementById(LIVE_REGION_ID) ?? document.createElement('div');
  region.id = LIVE_REGION_ID;
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('role', 'status');
  // Visually hidden, still read (the standard "sr-only" recipe).
  Object.assign(region.style, { position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: '0' });
  if (!region.parentNode) document.body.appendChild(region);
  return region;
}

export function announce(message: string) {
  if (!message) return;
  if (Platform.OS !== 'web') {
    AccessibilityInfo.announceForAccessibility?.(message);
    return;
  }
  const node = webRegion();
  if (!node) return;
  // Clear first so the same message twice is still announced.
  node.textContent = '';
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    node.textContent = message;
  }, 100);
}

/** Create the web live region early (app start) so the first announcement is heard. */
export function prepareAnnouncer() {
  if (Platform.OS === 'web') webRegion();
}
