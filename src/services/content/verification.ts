/**
 * The trust layer's small model. Three review states only - the ones the
 * content tables actually store - and sources described from the real URL
 * that was recorded. Nothing here invents a citation, an author, a date or
 * a review: an unknown site is shown by its web address, and there is no
 * "last reviewed" date because none is stored.
 */
export type VerificationLevel = 'verified' | 'partially_verified' | 'unverified';

export function normalizeVerification(value: string | null | undefined): VerificationLevel {
  return value === 'verified' || value === 'partially_verified' ? value : 'unverified';
}

/** i18n key for the calm, human wording of a review state. */
export function verificationCopyKey(level: VerificationLevel): string {
  return `sources.status.${level}`;
}

export type SourceKind = 'encyclopedia' | 'education' | 'news' | 'institution' | 'research' | 'media_archive' | 'document' | 'social' | 'website';

export type SourceInfo = { url: string; host: string; name: string; kind: SourceKind };

/** Known publishers by host. Names are the publishers' own public names -
 * this is how the source is labelled, not a claim of partnership. */
const KNOWN: { match: RegExp; name: string; kind: SourceKind }[] = [
  { match: /(^|\.)ky\.wikipedia\.org$/, name: 'Wikipedia (кыргызча)', kind: 'encyclopedia' },
  { match: /(^|\.)ru\.wikipedia\.org$/, name: 'Wikipedia (русский)', kind: 'encyclopedia' },
  { match: /(^|\.)en\.wikipedia\.org$/, name: 'Wikipedia (English)', kind: 'encyclopedia' },
  { match: /(^|\.)ru\.wikijournal\.org$/, name: 'WikiJournal', kind: 'encyclopedia' },
  { match: /(^|\.)commons\.wikimedia\.org$/, name: 'Wikimedia Commons', kind: 'media_archive' },
  { match: /(^|\.)encyclopedia\.edu\.kg$/, name: 'KyrgWiki', kind: 'encyclopedia' },
  { match: /(^|\.)kutbilim\.kg$/, name: 'Kutbilim', kind: 'education' },
  { match: /(^|\.)taalimforum\.kg$/, name: 'Taalim Forum', kind: 'education' },
  { match: /(^|\.)open\.kg$/, name: 'Open.kg', kind: 'website' },
  { match: /(^|\.)sputnik\.kg$/, name: 'Sputnik Кыргызстан', kind: 'news' },
  { match: /(^|\.)super\.kg$/, name: 'Super.kg', kind: 'news' },
  { match: /(^|\.)24\.kg$/, name: '24.kg', kind: 'news' },
  { match: /(^|\.)el\.kz$/, name: 'El.kz', kind: 'news' },
  { match: /(^|\.)kyrgyzinfo\.ru$/, name: 'KyrgyzInfo', kind: 'website' },
  { match: /(^|\.)altaycorpus\.ru$/, name: 'Altay Corpus', kind: 'research' },
  { match: /(^|\.)scribd\.com$/, name: 'Scribd', kind: 'document' },
  { match: /(^|\.)(facebook|instagram)\.com$/, name: 'Social media post', kind: 'social' },
  { match: /(^|\.)unesco\.org$/, name: 'UNESCO', kind: 'institution' },
];

export function describeSource(raw: string): SourceInfo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '');
  const known = KNOWN.find((entry) => entry.match.test(host));
  return { url: url.toString(), host, name: known?.name ?? host, kind: known?.kind ?? 'website' };
}

/** Real, openable sources only (malformed or non-web entries dropped),
 * de-duplicated, in the order they were recorded. */
export function describeSources(raw: readonly string[] | null | undefined): SourceInfo[] {
  const seen = new Set<string>();
  const out: SourceInfo[] = [];
  for (const entry of raw ?? []) {
    const info = describeSource(entry);
    if (info && !seen.has(info.url)) {
      seen.add(info.url);
      out.push(info);
    }
  }
  return out;
}

/** Editor rule (admin UI + database constraint): "verified" needs at least
 * one real source. Returns an error message or null. */
export function verificationError(level: string | null | undefined, rawSources: readonly string[] | null | undefined): string | null {
  if (normalizeVerification(level) !== 'verified') return null;
  return describeSources(rawSources).length > 0 ? null : 'Add at least one real source (https://...) before marking this as verified.';
}
