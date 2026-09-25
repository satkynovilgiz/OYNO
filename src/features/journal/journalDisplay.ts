import type { ImageSourcePropType } from 'react-native';

import { getCollection } from '@/features/collections/collectionsData';
import { cultureItemImages } from '@/features/culture/data';
import { natureSiteImages } from '@/features/explore/data';
import { getTrail } from '@/features/trails/trailsData';
import type { SupportedLanguage } from '@/i18n';
import { formatLongDate, formatMonthYear } from '@/services/i18n/formatDate';

import type { JournalLink, JournalLinkType } from './journalModel';


/** The linked content's own public artwork (never a user photo). */
export function linkArtwork(link: JournalLink | null): ImageSourcePropType | null {
  if (!link) return null;
  switch (link.type) {
    case 'nature_site':
      return natureSiteImages[link.id] ?? null;
    case 'collection':
      return getCollection(link.id)?.heroImage ?? null;
    case 'trail':
      return getTrail(link.id)?.heroImage ?? null;
    case 'culture_item':
      return cultureItemImages[link.id]?.[0] ?? null;
  }
}

/** The existing screen for the linked content. */
export function linkRoute(link: { type: JournalLinkType; id: string }): string {
  switch (link.type) {
    case 'nature_site':
      return `/explore/${link.id}`;
    case 'collection':
      return `/collections/${link.id}`;
    case 'trail':
      return `/trails/${link.id}`;
    case 'culture_item':
      return `/culture/item/${link.id}`;
  }
}

/** "SEPTEMBER 2026" style timeline heading for a YYYY-MM key. */
export function formatMonthHeading(month: string, language: SupportedLanguage): string {
  return formatMonthYear(month, language);
}

export function formatEntryDate(date: string, language: SupportedLanguage): string {
  return formatLongDate(date, language);
}

/** YYYY-MM-DD shifted by whole days (local calendar). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
