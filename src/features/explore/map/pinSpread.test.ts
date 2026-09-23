import { natureSiteCoordinates } from '@/features/explore/data';

import { projectLonLat } from './kyrgyzstanGeometry';
import { pinNudge, spreadPins } from './pinSpread';

jest.mock('@/features/explore/data', () => ({
  natureSiteCoordinates: {
    'son-kol': { lat: 41.83, lon: 75.13 },
    suusamyr: { lat: 42.18, lon: 73.95 },
    'ala-too': { lat: 42.55, lon: 74.5 },
    'sary-chelek': { lat: 41.87, lon: 71.95 },
  },
}));

// Map widths on 375 / 390 / 430 px screens (minus the frame gutters).
const MAP_WIDTHS = [343, 358, 398];
const MAP_WIDTH_375 = MAP_WIDTHS[0];
const VIEWBOX_WIDTH = 1048;

function screenPoints(width: number) {
  const k = width / VIEWBOX_WIDTH;
  return Object.values(natureSiteCoordinates).map(({ lon, lat }) => {
    const { x, y } = projectLonLat(lon, lat);
    return { x: x * k, y: y * k };
  });
}

describe('pin spreading', () => {
  it.each(MAP_WIDTHS.flatMap((width) => [44, 48, 56].map((hit) => [width, hit])))('map %i px wide: pins stay one %i px touch target apart', (width, hit) => {
    const points = screenPoints(width);
    const spread = spreadPins(points, hit);
    const shown = points.map((point, index) => {
      const nudge = pinNudge(spread[index], hit, 1);
      return { x: point.x + nudge.x, y: point.y + nudge.y };
    });
    for (let a = 0; a < shown.length; a++) {
      for (let b = a + 1; b < shown.length; b++) {
        expect(Math.hypot(shown[a].x - shown[b].x, shown[a].y - shown[b].y)).toBeGreaterThanOrEqual(hit);
      }
    }
  });

  it('leaves distant pins exactly where they are', () => {
    const points = screenPoints(MAP_WIDTH_375);
    const spread = spreadPins(points, 44);
    // Sary-Chelek is far from the highland cluster.
    expect(pinNudge(spread[3], 44, 1)).toEqual({ x: 0, y: 0 });
  });

  it('stops nudging once zoom has separated the pins', () => {
    const spread = spreadPins(
      [
        { x: 0, y: 0 },
        { x: 22, y: 0 },
      ],
      44,
    );
    expect(pinNudge(spread[0], 44, 1).x).toBeCloseTo(-11, 1);
    expect(pinNudge(spread[0], 44, 2)).toEqual({ x: 0, y: 0 });
    expect(pinNudge(spread[0], 44, 3)).toEqual({ x: 0, y: 0 });
  });
});
