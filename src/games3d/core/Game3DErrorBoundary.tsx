import { Component, type ReactNode } from 'react';

type Game3DErrorBoundaryProps = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
};

type Game3DErrorBoundaryState = { hasError: boolean };

/** Catches a 3D scene mount/render failure and shows the shared ErrorOverlay
 * instead of a black screen (Section 63). Class component because React
 * error boundaries have no hook equivalent. */
export class Game3DErrorBoundary extends Component<Game3DErrorBoundaryProps, Game3DErrorBoundaryState> {
  state: Game3DErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.error('[games3d] scene error', error);
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return this.props.fallback(this.retry);
    return this.props.children;
  }
}
