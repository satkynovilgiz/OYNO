import { QueryClient } from '@tanstack/react-query';

import { isRouteAvailableOffline } from './offlineAvailability';

describe('isRouteAvailableOffline', () => {
  it('requires cached data only for network-backed screens', () => {
    const client = new QueryClient();
    expect(isRouteAvailableOffline('/explore/son-kol', client)).toBe(false);
    expect(isRouteAvailableOffline('/culture/item/horse-eer', client)).toBe(false);
    expect(isRouteAvailableOffline('/games/chuko', client)).toBe(true);
    expect(isRouteAvailableOffline('/trails/horse-culture', client)).toBe(true);

    client.setQueryData(['explore_regions'], []);
    client.setQueryData(['discoveries'], []);
    client.setQueryData(['culture_item', 'horse-eer'], { id: 'horse-eer' });
    expect(isRouteAvailableOffline('/explore/son-kol', client)).toBe(true);
    expect(isRouteAvailableOffline('/culture/item/horse-eer', client)).toBe(true);
    expect(isRouteAvailableOffline('/explore/map?trail=nomad-life', client)).toBe(true);
    client.clear();
  });
});
