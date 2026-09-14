import { Component, type ReactNode } from 'react';

type ModelErrorBoundaryProps = {
  /** The procedural component to render instead, on any GLTF load/parse
   * failure - not just missing manifest entries. No blank screen, no
   * crashed game screen for a bad/missing model file. */
  fallback: ReactNode;
  children: ReactNode;
};

type ModelErrorBoundaryState = { hasError: boolean };

/** Catches a failed GLB load/parse (bad file, network error, unsupported
 * feature) and falls back to the procedural model instead of crashing the
 * whole game screen via the outer `Game3DErrorBoundary`. React error
 * boundaries must be class components - this is the one place in
 * games3d that needs to be. */
export class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[games3d] GLB load failed, falling back to procedural model:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
