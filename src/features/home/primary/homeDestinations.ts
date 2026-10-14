/** Secondary features, grouped behind a few clear EXISTING destinations (icons are mapped in HomeDestinations.tsx). */
export type DestinationId = 'games' | 'map' | 'activities' | 'shelf';
export type Destination = { id: DestinationId; route: string; titleKey: string };

export const HOME_DESTINATIONS: Destination[] = [
  { id: 'games', route: '/games', titleKey: 'home.nav.games' },
  { id: 'map', route: '/explore', titleKey: 'home.cultureTiles.map.title' },
  { id: 'activities', route: '/activities', titleKey: 'activityChooser.title' },
  { id: 'shelf', route: '/profile/shelf', titleKey: 'shelf.title' },
];
