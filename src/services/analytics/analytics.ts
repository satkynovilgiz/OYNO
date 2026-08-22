import { supabase } from '@/services/supabase/client';

/**
 * Minimal analytics abstraction (master prompt §32) backed by a real
 * Supabase table (analytics_events), not a third-party vendor - picking
 * a paid provider (Amplitude/Mixpanel/PostHog) is a cost/tooling
 * decision for the user, not one to default into. Fire-and-forget: a
 * failed analytics write must never surface to the user or block the
 * action it's describing. Never pass secrets, tokens, or full user
 * objects in `properties` - ids and small primitives only.
 */
export type AnalyticsEventName =
  | 'app_open'
  | 'onboarding_completed'
  | 'sign_up'
  | 'sign_in'
  | 'screen_view'
  | 'culture_open'
  | 'culture_complete'
  | 'location_open'
  | 'location_discovered'
  | 'quest_started'
  | 'quest_completed'
  | 'achievement_unlocked'
  | 'reward_claimed'
  | 'collection_item_discovered'
  | 'profile_updated';

export function track(eventName: AnalyticsEventName, properties?: Record<string, string | number | boolean>) {
  void supabase
    .from('analytics_events')
    .insert({ event_name: eventName, properties: properties ?? {} })
    .then(({ error }) => {
      if (error && __DEV__) console.warn('[analytics]', eventName, error.message);
    });
}
