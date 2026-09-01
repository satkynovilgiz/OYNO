import type { SymmetryMode } from './symmetry';

/**
 * Shyrdak Creator is a live-preview configurator, not a placement editor
 * (see the V2 plan - the task's own instruction is explicit about not
 * building a professional textile-design app). No editor state machine
 * needed, just a small config object and setters.
 */
export type ShyrdakConfig = {
  baseColor: string;
  secondaryColor: string;
  patternId: string;
  borderEnabled: boolean;
  symmetryMode: SymmetryMode;
};

export const DEFAULT_SHYRDAK_CONFIG: ShyrdakConfig = {
  baseColor: '#EADCC0',
  secondaryColor: '#7A3226',
  patternId: 'itKuiruk',
  borderEnabled: true,
  symmetryMode: 'fourWay',
};

export function setBaseColor(config: ShyrdakConfig, baseColor: string): ShyrdakConfig {
  return { ...config, baseColor };
}

export function setSecondaryColor(config: ShyrdakConfig, secondaryColor: string): ShyrdakConfig {
  return { ...config, secondaryColor };
}

export function setPattern(config: ShyrdakConfig, patternId: string): ShyrdakConfig {
  return { ...config, patternId };
}

export function toggleBorder(config: ShyrdakConfig): ShyrdakConfig {
  return { ...config, borderEnabled: !config.borderEnabled };
}

export function setSymmetryMode(config: ShyrdakConfig, symmetryMode: SymmetryMode): ShyrdakConfig {
  return { ...config, symmetryMode };
}

export function resetShyrdakConfig(): ShyrdakConfig {
  return DEFAULT_SHYRDAK_CONFIG;
}
