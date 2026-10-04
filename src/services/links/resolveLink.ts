import { komuzTracks } from '@/features/culture/audioData';
import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import { LEARNING_PATHS } from '@/features/learn/learningPaths';
import { CULTURAL_CALENDAR } from '@/features/culture/calendar/culturalCalendar';

import type { ContentLink } from './contentLinks';

export type Resolution = 'checking' | 'open' | 'invalid';

/** Does the linked public content exist? 'unknown' = can't tell yet
 * (still loading) - offline with nothing cached opens the screen, which
 * shows its own offline state. */
export function resolveLink(link: ContentLink | null, data: { items: { id: string }[] | undefined; materials: { id: string }[] | undefined; itemsSettled: boolean; materialsSettled: boolean }): Resolution {
  if (!link) return 'invalid';
  switch (link.type) {
    case 'glossary':
      return GLOSSARY.some((entry) => entry.id === link.id) ? 'open' : 'invalid';
    case 'learning_path':
      return LEARNING_PATHS.some((path) => path.id === link.id) ? 'open' : 'invalid';
    case 'calendar_event':
      return CULTURAL_CALENDAR.some((event) => event.id === link.id) ? 'open' : 'invalid';
    case 'komuz_track':
      return komuzTracks.some((entry) => entry.id === link.id) ? 'open' : 'invalid';
    case 'game':
      return 'open';
    case 'culture_item':
      if (data.items) return data.items.some((item) => item.id === link.id) ? 'open' : 'invalid';
      return data.itemsSettled ? 'open' : 'checking';
    case 'culture_material':
      if (data.materials) return data.materials.some((material) => material.id === link.id) ? 'open' : 'invalid';
      return data.materialsSettled ? 'open' : 'checking';
  }
}

