import { natureSiteCoordinates } from '../data';

import { MAP_VIEWBOX_HEIGHT, MAP_VIEWBOX_WIDTH, projectLonLat } from './kyrgyzstanGeometry';

describe('interactive map geometry', () => {
  it('has a position for exactly the six nature destinations', () => {
    expect(Object.keys(natureSiteCoordinates).sort()).toEqual(['ala-too', 'alay', 'arslanbob', 'sary-chelek', 'son-kol', 'suusamyr']);
  });

  it('projects every destination inside the map', () => {
    for (const { lat, lon } of Object.values(natureSiteCoordinates)) {
      const { x, y } = projectLonLat(lon, lat);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(MAP_VIEWBOX_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MAP_VIEWBOX_HEIGHT);
    }
  });

  it('keeps north up and east right', () => {
    const northWest = projectLonLat(70, 43);
    const southEast = projectLonLat(79, 40);
    expect(northWest.x).toBeLessThan(southEast.x);
    expect(northWest.y).toBeLessThan(southEast.y);
  });
});
