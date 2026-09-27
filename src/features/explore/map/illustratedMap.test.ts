import * as fs from 'fs';
import * as path from 'path';

import { exploreMapPins, natureSiteCoordinates } from '../data';

import { ILLUSTRATED_MAP_ASPECT, ILLUSTRATED_MAP_COORDINATES, panLimits } from './illustratedMap';

const ROOT = path.join(__dirname, '../../../..');

describe('illustrated atlas', () => {
  it('places every real destination - the 8 preview regions and the 6 Passport sites - and nothing else', () => {
    const regionIds = exploreMapPins.map((pin) => pin.locationId);
    const natureIds = Object.keys(natureSiteCoordinates);
    expect(Object.keys(ILLUSTRATED_MAP_COORDINATES).sort()).toEqual([...regionIds, ...natureIds].sort());
  });

  it('keeps every pin inside Kyrgyzstan on the painting (neighbours are context only)', () => {
    // Kyrgyzstan's painted outline spans roughly x 9-98%, y 20-75%.
    for (const { xPercent, yPercent } of Object.values(ILLUSTRATED_MAP_COORDINATES)) {
      expect(xPercent).toBeGreaterThan(9);
      expect(xPercent).toBeLessThan(98);
      expect(yPercent).toBeGreaterThan(20);
      expect(yPercent).toBeLessThan(75);
    }
  });

  it('keeps the painting in the right broad order (north up, east right)', () => {
    const at = (id: string) => ILLUSTRATED_MAP_COORDINATES[id];
    expect(at('bishkek').yPercent).toBeLessThan(at('osh').yPercent);
    expect(at('batken').xPercent).toBeLessThan(at('osh').xPercent);
    expect(at('ysyk-kol').xPercent).toBeGreaterThan(at('bishkek').xPercent);
    expect(at('alay').yPercent).toBeGreaterThan(at('osh').yPercent);
  });

  it('matches the source image aspect', () => {
    expect(ILLUSTRATED_MAP_ASPECT).toBeCloseTo(1448 / 1086, 5);
  });

  it('pan limits: centred at rest, only the zoomed overflow can be panned', () => {
    expect(panLimits(360, 270, 360, 267, 1)).toEqual({ maxX: 0, maxY: 1.5 });
    expect(panLimits(360, 270, 360, 270, 2)).toEqual({ maxX: 180, maxY: 135 });
    // A map wider than its frame at rest can pan across just that overflow.
    expect(panLimits(450, 338, 360, 338, 1)).toEqual({ maxX: 45, maxY: 0 });
    // Never negative - a smaller map can't be pushed around.
    expect(panLimits(300, 200, 360, 338, 1)).toEqual({ maxX: 0, maxY: 0 });
  });

  it('preview and full map render the same atlas, not the old baked-pin art', () => {
    for (const file of ['src/features/explore/components/KyrgyzstanMap.tsx', 'src/features/explore/map/InteractiveMapScreen.tsx']) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source).toMatch(/ILLUSTRATED_MAP_IMAGE/);
      expect(source).not.toMatch(/map_terrain/);
    }
  });
});
