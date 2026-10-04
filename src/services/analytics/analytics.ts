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
  | 'profile_updated'
  | 'culture_material_open'
  | 'oymo_creator_open'
  | 'boz_uy_build_completed'
  | 'shyrdak_creator_open'
  | 'komuz_lesson_open'
  | 'komuz_lesson_completed'
  | 'explore_opened'
  | 'region_opened'
  | 'discovery_found'
  | 'quest_step_completed'
  | 'explore_search'
  | 'explore_filter_used'
  | 'age_group_selected'
  | 'home_recommendation_shown'
  | 'home_recommendation_opened'
  | 'reminder_enabled'
  | 'reminder_disabled'
  | 'reminder_opened'
  | 'notification_opened'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'sync_conflict_merged'
  | 'sources_opened'
  | 'companion_moment_shown'
  | 'home_continue_region_opened'
  | 'region_audio_journey_opened'
  | 'map_region_progress_opened'
  | 'culture_then_now_opened'
  | 'culture_compare_opened'
  | 'privacy_center_opened'
  | 'pronunciation_practice_opened'
  | 'pronunciation_record_started'
  | 'pronunciation_practice_completed'
  | 'data_export_started'
  | 'private_data_reset'
  | 'game_coach_tip_shown'
  | 'game_coach_tip_opened'
  | 'journal_collage_created'
  | 'journal_collage_shared'
  | 'learning_timeline_opened'
  | 'read_listen_started'
  | 'content_link_shared'
  | 'content_link_opened'
  | 'recap_opened'
  | 'recap_shared'
  | 'collection_created'
  | 'collection_item_added'
  | 'collection_item_removed'
  | 'challenge_review_opened'
  | 'challenge_review_answered'
  | 'komuz_listening_room_opened'
  | 'komuz_track_started'
  | 'reading_opened'
  | 'reading_resumed'
  | 'highlight_saved'
  | 'highlight_removed'
  | 'friend_challenge_shared'
  | 'friend_challenge_opened'
  | 'friend_challenge_completed'
  | 'glossary_study_started'
  | 'glossary_card_reviewed'
  | 'glossary_study_completed'
  | 'culture_gallery_opened'
  | 'culture_gallery_item_opened'
  | 'home_recommendation_dismissed'
  | 'weekly_goal_set'
  | 'weekly_goal_completed';

export function track(eventName: AnalyticsEventName, properties?: Record<string, string | number | boolean>) {
  void supabase
    .from('analytics_events')
    .insert({ event_name: eventName, properties: properties ?? {} })
    .then(({ error }) => {
      if (error && __DEV__) console.warn('[analytics]', eventName, error.message);
    });
}
