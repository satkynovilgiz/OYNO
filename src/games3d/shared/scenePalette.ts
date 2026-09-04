/** 3D-scene color palette (Section 9) - separate from src/theme/colors.ts
 * because these are raw hex strings fed to Three.js materials, not RN
 * StyleSheet colors, but chosen to read as the same OYNO palette: warm
 * beige, forest green, earth brown, terracotta, muted gold. */
export const scenePalette = {
  skyTop: '#8FB3C7',
  skyHorizon: '#F3E5C9',
  mountainFar: '#9AA6AC',
  mountainMid: '#6B5A47',
  mountainNear: '#5C4326',
  grass: '#3C6E47',
  grassShadow: '#2F5233',
  dirt: '#8B6B3D',
  terracotta: '#B9793A',
  gold: '#E8B93D',
  wood: '#5C4326',
  fletching: '#D64545',
} as const;

/** 1 unit ~= 1 meter (Section 89) - keep every game's props/characters/
 * distances consistent with this so physics and cameras behave predictably. */
export const WORLD_SCALE = { metersPerUnit: 1 } as const;
