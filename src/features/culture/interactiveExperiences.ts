import { cultureCategoryImages } from './data';
import type { InteractiveExperience } from './components';

/** The only categories with a real, working interactive module today
 * (spec CultureScreen comment: "real interactive modules only... a tile
 * leading nowhere would be exactly the kind of dead button the task
 * explicitly calls out") - shared here so CultureScreen's own row and
 * CultureCategoryDetailScreen's featured card never drift out of sync
 * about which categories actually have one. */
export const INTERACTIVE_EXPERIENCE_ROUTES: Record<string, string> = {
  oymo: '/culture/oymo/create',
  'boz-uy': '/culture/boz-uy/build',
  shyrdak: '/culture/shyrdak/create',
  komuz: '/culture/komuz/learn',
};

export const INTERACTIVE_EXPERIENCES: InteractiveExperience[] = [
  { id: 'oymo', titleKey: 'culture.interactive.oymo', imageSource: cultureCategoryImages.oymo },
  { id: 'boz-uy', titleKey: 'culture.interactive.bozUy', imageSource: cultureCategoryImages['boz-uy'] },
  { id: 'shyrdak', titleKey: 'culture.interactive.shyrdak', imageSource: cultureCategoryImages.shyrdak },
  { id: 'komuz', titleKey: 'culture.interactive.komuz', imageSource: cultureCategoryImages.komuz },
];

export function interactiveExperienceForCategory(categoryId: string): InteractiveExperience | null {
  return INTERACTIVE_EXPERIENCES.find((experience) => experience.id === categoryId) ?? null;
}

export function routeForInteractiveExperience(id: string): string | null {
  return INTERACTIVE_EXPERIENCE_ROUTES[id] ?? null;
}
