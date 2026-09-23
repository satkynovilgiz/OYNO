import { Component, type ReactNode } from 'react';

import { captureException } from '@/services/monitoring/sentry';

/**
 * For invisible background helpers mounted at the root (widget snapshot
 * sync, reminder scheduling): if one of them throws while rendering, it is
 * reported and quietly switched off for this session instead of replacing
 * the whole app with the root error screen.
 */
export class SilentErrorBoundary extends Component<{ name: string; children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.warn(`[${this.props.name}] disabled after a crash:`, error);
    captureException(error, { scope: this.props.name });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
