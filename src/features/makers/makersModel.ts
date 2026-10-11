/**
 * Meet the Makers - schema only, for now. Profiles of real craftspeople and
 * musicians need their own words and their recorded permission, and OYNO has
 * neither yet, so `MAKERS` is EMPTY and the public entry is OFF.
 *
 * `FIXTURE_MAKERS` is an internal, clearly labelled demo used only by the
 * admin preview (/admin/makers) and the tests. It describes no real person:
 * its name and text say so. Fixtures are never returned by `publicMakers`.
 *
 * Nothing in this file may be filled in by guessing: no invented people,
 * bios, quotations, photos or audio (docs/MEET_THE_MAKERS.md has the
 * contributor checklist).
 */
import type { SupportedLanguage } from '@/i18n';

/** Off until real, consented profiles exist and have been reviewed. */
export const MAKERS_PUBLIC_ENABLED = false;

export type ConsentScope = 'name' | 'bio' | 'region' | 'photo' | 'audio' | 'video';
export type Consent = {
  status: 'granted' | 'pending' | 'withdrawn';
  /** What the maker agreed to show - nothing outside it is displayed. */
  scope: ConsentScope[];
  /** ISO date the permission was recorded. */
  recordedOn: string | null;
  /** Where the signed permission is kept (an internal reference, never shown). */
  reference: string | null;
};
export type MakerMedia = {
  kind: 'photo' | 'audio' | 'video';
  uri: string | null;
  /** Alt text (photo) or transcript/description (audio, video), per language. */
  description: Partial<Record<SupportedLanguage, string>>;
  credit: string | null;
  license: string | null;
};
export type MakerProfile = {
  id: string;
  /** Internal demo data - never public. */
  fixture: boolean;
  reviewStatus: 'draft' | 'in_review' | 'approved';
  name: string;
  craft: 'felt' | 'embroidery' | 'woodwork' | 'boz_uy' | 'komuz' | 'jewelry' | 'leather' | 'other';
  region: string | null;
  /** In the maker's own words (or approved by them), per language. Kyrgyz is required. */
  bio: Partial<Record<SupportedLanguage, string>>;
  /** Existing article ids this profile links to. */
  relatedArticleIds: string[];
  media: MakerMedia[];
  consent: Consent;
};

/** Real profiles. Empty until real content and permissions arrive. */
export const MAKERS: MakerProfile[] = [];

export const FIXTURE_LABEL = 'DEMO FIXTURE - not a real person';
export const FIXTURE_MAKERS: MakerProfile[] = [
  {
    id: 'fixture-demo-maker',
    fixture: true,
    reviewStatus: 'draft',
    name: `Demo maker (${FIXTURE_LABEL})`,
    craft: 'felt',
    region: null,
    bio: { kg: 'Демо текст. Бул чыныгы адам эмес.', ru: 'Демо-текст. Это не настоящий человек.', en: 'Demo text. This is not a real person.' },
    relatedArticleIds: ['boz-uy-ichki-jasalga'],
    media: [
      { kind: 'photo', uri: null, description: { en: 'No photo - shows the placeholder.' }, credit: null, license: null },
      { kind: 'audio', uri: 'https://example.invalid/demo.m4a', description: { en: 'Demo audio entry without permission - must not play.' }, credit: 'Demo', license: 'none' },
    ],
    consent: { status: 'pending', scope: ['name', 'bio'], recordedOn: null, reference: null },
  },
];

const SCOPE_FOR: Record<MakerMedia['kind'], ConsentScope> = { photo: 'photo', audio: 'audio', video: 'video' };

/** Problems that keep a profile from ever being shown publicly. */
export function validateMaker(profile: MakerProfile, articleExists: (id: string) => boolean = () => true): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+$/.test(profile.id)) errors.push('id must be lowercase letters, digits and dashes');
  if (!profile.name.trim()) errors.push('name is required');
  if (!profile.bio.kg?.trim()) errors.push('a Kyrgyz bio is required');
  if (profile.consent.status !== 'granted') errors.push(`consent is ${profile.consent.status}`);
  if (profile.consent.status === 'granted' && (!profile.consent.recordedOn || !profile.consent.reference)) errors.push('granted consent needs a recorded date and a reference');
  for (const field of ['name', 'bio'] as const) if (!profile.consent.scope.includes(field)) errors.push(`consent does not cover "${field}"`);
  if (profile.region && !profile.consent.scope.includes('region')) errors.push('consent does not cover "region"');
  if (profile.reviewStatus !== 'approved') errors.push(`review status is ${profile.reviewStatus}`);
  for (const id of profile.relatedArticleIds) if (!articleExists(id)) errors.push(`related article "${id}" does not exist`);
  profile.media.forEach((media, index) => {
    if (media.uri && !profile.consent.scope.includes(SCOPE_FOR[media.kind])) errors.push(`media ${index} (${media.kind}) is not covered by consent`);
    if (media.uri && (!media.credit || !media.license)) errors.push(`media ${index} needs a credit and a license`);
    if (media.uri && !media.description.kg?.trim()) errors.push(`media ${index} needs a Kyrgyz description`);
  });
  if (profile.fixture) errors.push('fixture data is never public');
  return errors;
}

/** What the public may see: real, valid, approved, consented profiles - never fixtures. */
export function publicMakers(profiles: MakerProfile[] = MAKERS, articleExists?: (id: string) => boolean): MakerProfile[] {
  if (!MAKERS_PUBLIC_ENABLED) return [];
  return profiles.filter((profile) => !profile.fixture && validateMaker(profile, articleExists).length === 0);
}

export type ResolvedMedia = { kind: MakerMedia['kind']; uri: string; description: string; credit: string; license: string } | { kind: 'placeholder'; of: MakerMedia['kind']; reason: 'missing' | 'no_consent' | 'no_credit' | 'no_description' };

/** A media item is shown only when it exists, is consented, credited and described - otherwise a neutral placeholder (never a stand-in photo or sound). */
export function resolveMedia(media: MakerMedia, consent: Consent, language: SupportedLanguage): ResolvedMedia {
  if (!media.uri) return { kind: 'placeholder', of: media.kind, reason: 'missing' };
  if (consent.status !== 'granted' || !consent.scope.includes(SCOPE_FOR[media.kind])) return { kind: 'placeholder', of: media.kind, reason: 'no_consent' };
  if (!media.credit || !media.license) return { kind: 'placeholder', of: media.kind, reason: 'no_credit' };
  const description = media.description[language] ?? media.description.kg;
  if (!description?.trim()) return { kind: 'placeholder', of: media.kind, reason: 'no_description' };
  return { kind: media.kind, uri: media.uri, description, credit: media.credit, license: media.license };
}
