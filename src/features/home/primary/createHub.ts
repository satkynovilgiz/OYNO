import { ACTIVITY_CATALOG } from '../chooser/activityChooser';

/**
 * The Create destination's contents - EXISTING screens only, grouped:
 *  make  - the chooser's validated create activities (same titles/routes);
 *  tools - custom motifs and Color Lab;
 *  work  - where saved designs live.
 */
export type CreateEntry = { id: string; route: string; titleKey: string; bodyKey: string };
export type CreateGroup = { id: 'make' | 'tools' | 'work'; entries: CreateEntry[] };

const MAKE_ORDER = ['oymo', 'shyrdak', 'bozUy', 'restore'];

export const CREATE_GROUPS: CreateGroup[] = [
  {
    id: 'make',
    entries: MAKE_ORDER.map((id) => ACTIVITY_CATALOG.find((activity) => activity.id === id && activity.interest === 'create')!).map((activity) => ({
      id: activity.id,
      route: activity.route,
      titleKey: activity.titleKey!,
      bodyKey: activity.descriptionKey,
    })),
  },
  {
    id: 'tools',
    entries: [
      { id: 'motifs', route: '/culture/oymo/motifs', titleKey: 'customMotif.title', bodyKey: 'createHub.motifsBody' },
      { id: 'colorLab', route: '/culture/oymo/colors', titleKey: 'colorLab.title', bodyKey: 'createHub.colorLabBody' },
    ],
  },
  {
    id: 'work',
    entries: [{ id: 'shelf', route: '/profile/shelf', titleKey: 'shelf.title', bodyKey: 'createHub.shelfBody' }],
  },
];
