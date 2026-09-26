import { CHARACTERS_WITH_FULL_SHEET, type CharacterId } from '@/components/character/characterAssets';

/**
 * Profile setup = three different things, in order:
 *   name       the display name (not a legal name)
 *   character  the Story Companion - the OYNO guide, NOT the user
 *   avatar     the user's own avatar - "this is me"
 */
export const PROFILE_SETUP_STEPS = ['name', 'character', 'avatar'] as const;
export type ProfileSetupStep = (typeof PROFILE_SETUP_STEPS)[number];

export function stepNumber(step: ProfileSetupStep): number {
  return PROFILE_SETUP_STEPS.indexOf(step) + 1;
}

/** Only rule the account actually has: not empty. Returns an i18n key. */
export function displayNameError(name: string): string | null {
  return name.trim() ? null : 'profileSetup.nameError';
}

/** A companion can be confirmed only if its full character sheet exists
 * (Бөрү / Тулпар / Элчи stay "Coming soon" until their art is complete). */
export function isSelectableCompanion(id: CharacterId | null | undefined): id is CharacterId {
  return !!id && CHARACTERS_WITH_FULL_SHEET.includes(id);
}
