/**
 * The 4 Boz Üy Builder steps, in construction order. Content is sourced
 * from the verified `culture_items` row `boz-uy-overview`
 * (objects_used/traditional_method fields, see
 * supabase/migrations/20260829000005_boz_uy_oymo_shyrdak_content.sql) -
 * бозого (door frame) and каалга (door) are combined into a single
 * "bosogo" step since the source describes them as hung together at the
 * end, not as separate structural stages. i18n keys only (no raw strings
 * here) so this file stays UI-string-free and easy to keep in sync with
 * the source content.
 */
export type BozUyStepId = 'kerege' | 'uuk' | 'tunduk' | 'bosogo';

export type BozUyStep = {
  id: BozUyStepId;
  nameKey: string;
  descriptionKey: string;
  tipKey: string;
};

export const BOZ_UY_STEPS: readonly BozUyStep[] = [
  {
    id: 'kerege',
    nameKey: 'culture.bozUy.steps.kerege.name',
    descriptionKey: 'culture.bozUy.steps.kerege.description',
    tipKey: 'culture.bozUy.steps.kerege.tip',
  },
  {
    id: 'uuk',
    nameKey: 'culture.bozUy.steps.uuk.name',
    descriptionKey: 'culture.bozUy.steps.uuk.description',
    tipKey: 'culture.bozUy.steps.uuk.tip',
  },
  {
    id: 'tunduk',
    nameKey: 'culture.bozUy.steps.tunduk.name',
    descriptionKey: 'culture.bozUy.steps.tunduk.description',
    tipKey: 'culture.bozUy.steps.tunduk.tip',
  },
  {
    id: 'bosogo',
    nameKey: 'culture.bozUy.steps.bosogo.name',
    descriptionKey: 'culture.bozUy.steps.bosogo.description',
    tipKey: 'culture.bozUy.steps.bosogo.tip',
  },
] as const;

export function clampStepIndex(index: number): number {
  return Math.min(Math.max(index, 0), BOZ_UY_STEPS.length - 1);
}

export function isLastStep(stepIndex: number): boolean {
  return stepIndex >= BOZ_UY_STEPS.length - 1;
}
