# OYNO Backend Migration Plan

Written in response to the "OYNO — PRODUCTION BACKEND + REAL APP ENGINEERING
PROMPT" (2026-08-22). That prompt's own Section 129 says: *"Do NOT attempt
to generate all production code blindly in one response... First inspect
the existing codebase. Then create an implementation plan. Then implement
Phase 1."* This document is that inspection + plan, produced before any
backend code is written. It should be read alongside `PROGRESS_AUDIT.md`
(what's built and how it was verified) — this document is about what's
**not yet real** and the concrete path to make it real.

This is a living document, like `PROGRESS_AUDIT.md` — append to it as each
backend phase lands, rather than rewriting it.

---

## 1. Architecture Audit — current state, as of commit `72aa0b3`

**The honest one-line summary: OYNO today is a fully local, single-device
prototype. Nothing survives a reinstall, nothing is shared across devices,
and every number a user sees (XP, coins, achievements, streak) is
trivially editable by anyone with access to the device's local storage.
There is no backend, no database, and zero network calls anywhere in the
codebase.**

| Area | Current reality |
|---|---|
| **Auth** | `LocalAuthService` (`src/services/auth/LocalAuthService.ts`) - passwords hashed (SHA-256 + per-user salt) but stored in `AsyncStorage`/`localStorage` (web) or `SecureStore` (native), on-device only. No email verification, no password-reset email delivery (the reset code is handed straight back to the UI to display), no server-side validation, no multi-device session, no OAuth. Built explicitly behind an `AuthService` interface for exactly this migration - see §4. |
| **User progress (XP/coins/achievements/streak)** | `useProgressStore` (`src/store/useProgressStore.ts`), Zustand + `AsyncStorage`, 100% client-authoritative. A user can open devtools and set `xp: 999999` directly. All 4 real achievement conditions are checked client-side. |
| **Content (Culture, Explore)** | Hardcoded TypeScript arrays - `src/features/culture/data.ts` (10 categories, 3 materials, 1 "today's discovery"), `src/features/explore/data.ts` (19 locations across 8 regions, 4 discoveries, 1 quest). No CMS, no admin, no way to update without a full app rebuild+release. |
| **Games** | 11 games listed in `src/features/games/mockData.ts`; only **Беш таш** is actually playable (pure local game-logic engine, no server validation of wins). Тогуз коргоол has a tested engine (`games/toguzKorgool/engine`) but no screen. The other 9 have thumbnails and nothing else. |
| **Settings / Notifications** | `useSettingsStore`/`useNotificationsStore` - local `AsyncStorage` only. Notifications list is a static mock array (`src/features/notifications/data.ts`); there is no push notification infrastructure at all (no Expo push token registration, nothing server-triggered). |
| **Network** | Confirmed zero `fetch`/`axios`/network calls anywhere in `src/` or `games/`. `@tanstack/react-query`'s `QueryClient` is provided (`src/services/queryClient.ts`, wired to `expo-network`'s `onlineManager` as of Phase 5) but **no screen calls `useQuery`/`useMutation` - it's unused scaffolding today.** |
| **Storage/media** | All images are bundled app assets (`assets/img/...`), not uploaded/served content. No cloud storage, no avatar upload, no image validation pipeline. |
| **Admin** | Does not exist in any form. |
| **Analytics / crash reporting** | Does not exist. No Sentry, no analytics abstraction, no event tracking. |
| **Error/offline resilience** | Real, as of Phase 5: `safeJsonParse` storage-corruption recovery, `loadWithTimeout` boot backstop, a global `ErrorBoundary`, and a real (if currently unused) offline banner + `onlineManager` wiring. This is the one area of this prompt that's already substantially done - see `PROGRESS_AUDIT.md` Phase 5. |
| **i18n** | Real and solid - `src/i18n/locales/{kg,ru,en}.json`, consistent translation-key usage, kg default with graceful fallback already in place (i18next's own fallback chain). Nothing to migrate here. |
| **Deployment** | EAS project already exists (`projectId: bad293a4-8544-4fb6-8b5f-776a51bd4f7b`), EAS Update is already being published to a `preview` branch after each phase. No `ios.bundleIdentifier`/`android.package` set yet in `app.json` - needed before any store submission, not blocking backend work. |

### What's genuinely good news for this migration

The `service interface + Local*Service implementation + Zustand store`
pattern used throughout this codebase (`AuthService`/`LocalAuthService`,
and the same shape informally in `useProgressStore`/`useSettingsStore`)
was **built from Phase 2 onward specifically as a swap-in seam** for this
exact migration. The doc comment on `LocalAuthService` already says so:
*"Swap-in plan: implement `AuthService` again as `SupabaseAuthService` and
change one import in `src/store/useAuthStore.ts`. Nothing else (screens,
navigation, the store's own API) should need to change."* That plan holds.
Screens were built against interfaces/hooks, not against `AsyncStorage`
directly - the migration is a service-layer swap, not a screen rewrite.

---

## 2. Missing Functionality List

Mapped against the master prompt's own section numbers. **Missing** = does
not exist at all. **Local-only** = exists and works, but is client-side
and not backend-authoritative. **N/A (no UI yet)** = the master prompt
asks for backend support for a feature that has no screen in the app at
all yet (building a full backend for a feature nobody can reach is
premature - flagged, not silently dropped).

| # | Feature | Status |
|---|---|---|
| 4-7 | Real auth, email verification, password security | Local-only |
| 8-10 | Normalized DB, relationships, RLS | Missing |
| 11-17 | Server-authoritative XP/coins/rewards/daily tasks/streak/achievements | Local-only (client-authoritative) |
| 18 | Collection system (DB-backed) | Local-only (mock catalog, real unlock *state* but client-side) |
| 19-23 | Culture/Explore CMS + admin | Missing (content is hardcoded TS) |
| 20-22, 87-89 | Admin panel + RBAC + audit log | Missing |
| 24-27 | Remote config, maintenance mode, version gating | Missing |
| 28-31 | Push notifications, notification DB, deep links, share links | Deep links partially exist (`oyno://` scheme registered, in-app-only navigation); push infra Missing |
| 32-33 | Analytics, crash reporting | Missing |
| 34-37 | Structured logging, standardized errors, rate limiting, anti-cheat | Missing (errors are ad hoc `AuthError`/try-catch today, not standardized categories) |
| 38-40, 93-95 | Multiplayer/leaderboard/friends prep, game backend API | N/A (no UI - only 1 game is playable, single-player, no matches/friends screens exist) |
| 41-42 | Reporting, blocking | N/A (no social features exist to report/block within) |
| 43 | Content versioning | Missing (no CMS yet to version) |
| 44-46 | Cloud image storage, image validation, avatar upload | Missing (avatars are a fixed set of bundled character portraits, no upload UI) |
| 47-48 | Audio/music CMS, content-rights tracking | N/A (no music/audio playback feature exists in the app at all yet) |
| 49-53 | Privacy architecture, account deletion, data export | Account deletion **is real** (local-only - deletes the local record); data export Missing |
| 51 | Terms/Privacy/Community Guidelines screens | Placeholder text exists (`AboutScreen`), explicitly marked "not ready yet" rather than fabricated - correct per prior phases, still needs real legal text before production |
| 54-56 | Backups, migrations, seed data | Missing (nothing to back up yet - no DB) |
| 60-63 | Accessibility, performance/pagination/caching | Partially - lists are small enough today that pagination hasn't been needed; no accessibility audit done yet |
| 68-71 | Service-layer architecture, generated types, state-management discipline, forms | **Substantially already true** - see §1 "good news" |
| 72-75 | Security/DB/E2E/UI testing | Only pure-function unit tests exist (Jest, 56 passing) - no integration/E2E/security tests, because there's no backend to test yet |
| 76-77 | CI/CD, EAS build channels | Missing (builds/updates have been run manually each phase) |
| 96-98 | Feature flags, remote home content, announcements | Missing |
| 99-102 | User feedback, support tickets, search, favorites | Missing (no feedback form, no search, no favorites system) |
| 103-105 | Profile privacy/sharing, content reporting | Missing |
| 110-113 | Production monitoring, backend functions, API security | Missing |

**Bottom line**: nearly everything in this prompt is genuinely missing,
because there has never been a backend. The prompt itself predicted this
("first inspect... identify what is mocked, hard-coded, not connected to
backend") - this table is that inspection.

---

## 3. Database Schema

Postgres/Supabase conventions throughout: `uuid` PKs (`gen_random_uuid()`),
`timestamptz` for all timestamps, `created_at`/`updated_at` on every table,
soft-delete (`deleted_at`) only where users can be restored (per §9).
Content tables use a stable `slug text unique` alongside the `uuid` PK,
matching the string ids already used throughout the existing TypeScript
code (`'first-win'`, `'ysyk-kol'`, `'besh-tash'`, etc.) - so migrating
existing local ids into the DB as slugs is a direct mapping, not a rewrite.

This section gives full DDL for the tables **Phase 1 of the implementation
plan (§6) actually needs** - the ones backing features that already exist
in the shipped app. Tables for features with no UI yet (§2's "N/A" rows)
are listed with a one-line shape sketch only, per the master prompt's own
instruction to prepare-but-not-build them (§38-40, 93-95).

### 3.1 Core (Phase 1)

```sql
-- Supabase's auth.users is the source of truth for identity/credentials.
-- profiles is the public/app-facing extension of it.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  character_id text not null default 'bek',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifications jsonb not null default '{}',
  privacy jsonb not null default '{}',
  game jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  games_played integer not null default 0,
  games_won integer not null default 0,
  streak_days integer not null default 0,
  last_active_date date,
  quest_found_count integer not null default 0,
  quest_completed boolean not null default false,
  boz_uy_visited boolean not null default false,
  culture_discovery_count integer not null default 0,
  updated_at timestamptz not null default now()
);
-- NEVER updated directly by client writes - only by SECURITY DEFINER
-- functions/Edge Functions. See §5.

create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  source text not null, -- 'daily_challenge' | 'daily_gift' | 'quest_complete' | 'culture_discovery' | 'boz_uy_visit' | 'explore_discovery' | ...
  reference_id text,     -- e.g. the discovery/quest id, for dedupe + audit
  created_at timestamptz not null default now()
);

create table coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null, -- signed: positive = credit, negative = debit
  type text not null,      -- 'reward' | 'purchase' | 'adjustment'
  source text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create table game_definitions (
  id text primary key, -- slug, e.g. 'besh-tash'
  name_ky text not null, name_ru text not null, name_en text not null,
  thumbnail_url text,
  category text not null,
  difficulty text not null,
  players text not null,
  status text not null default 'planned' check (status in ('planned','development','published','disabled')),
  sort_order integer not null default 0
);

create table user_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references game_definitions(id),
  played integer not null default 0,
  won integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table achievements (
  id text primary key, -- slug, e.g. 'first-win'
  title_ky text not null, title_ru text not null, title_en text not null,
  icon_url text,
  condition_type text not null, -- discriminator the check-engine reads, e.g. 'games_won_gte'
  condition_value jsonb not null default '{}',
  sort_order integer not null default 0
);

create table user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references achievements(id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
-- Row existing = unlocked. Primary key doubles as the duplicate-unlock guard.

create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  kind text not null, -- 'win_game' | 'play_n_games' | ...
  target integer not null,
  reward_xp integer not null,
  reward_coins integer not null,
  unique (task_date, kind)
);

create table daily_task_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references daily_tasks(id),
  progress integer not null default 0,
  claimed_at timestamptz,
  primary key (user_id, task_id)
);
-- claimed_at being non-null is the duplicate-claim guard (§14).

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null, -- 'daily_task' | 'achievement' | 'quest' | 'culture_new' | 'system'
  deep_link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);
```

### 3.2 Content / CMS (Phase 3 - migrating what's already hardcoded)

```sql
create table culture_categories (
  id text primary key, -- slug, e.g. 'boz-uy'
  title_ky text not null, title_ru text not null, title_en text not null,
  image_url text,
  total integer not null default 0, -- catalog size shown as "X / total"
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table culture_items (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references culture_categories(id),
  title_ky text not null, title_ru text not null, title_en text not null,
  description_ky text, description_ru text, description_en text,
  image_url text,
  type text, -- 'reading' | 'video' | 'game', for "New materials"
  duration_minutes integer,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_culture_discoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  culture_item_id uuid not null references culture_items(id),
  discovered_at timestamptz not null default now(),
  primary key (user_id, culture_item_id)
);

create table explore_regions (
  id text primary key, -- slug, e.g. 'ysyk-kol'
  kind text not null,  -- 'region' | 'nature'
  name_ky text not null, name_ru text not null, name_en text not null,
  tagline text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table explore_locations (
  id uuid primary key default gen_random_uuid(),
  region_id text references explore_regions(id),
  title_ky text not null, title_ru text not null, title_en text not null,
  category text not null, -- 'nature' | 'culture' | 'animals' | 'food'
  xp_reward integer not null default 0,
  image_url text,
  lat double precision, lng double precision,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_discoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  explore_location_id uuid not null references explore_locations(id),
  discovered_at timestamptz not null default now(),
  primary key (user_id, explore_location_id)
);

create table quests (
  id text primary key,
  title_ky text not null, title_ru text not null, title_en text not null,
  character_id text,
  total_count integer not null,
  reward_xp integer not null,
  reward_coins integer not null,
  status text not null default 'draft' check (status in ('draft','review','published','archived'))
);

create table user_quests (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null references quests(id),
  found_count integer not null default 0,
  completed_at timestamptz,
  primary key (user_id, quest_id)
);
```

### 3.3 Admin / platform (Phase 4)

```sql
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','content_editor','moderator','analytics_viewer')),
  created_at timestamptz not null default now()
);

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,      -- e.g. 'culture_item.publish'
  target_table text not null,
  target_id text not null,
  before jsonb, after jsonb,
  created_at timestamptz not null default now()
);

create table app_config (
  key text primary key, -- 'minimum_supported_version' | 'maintenance_mode' | 'featured_culture_item_id' | ...
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table feature_flags (
  key text primary key, -- 'gamesEnabled' | 'musicEnabled' | ...
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  target_type text not null, target_id text not null,
  category text not null, -- 'spam' | 'harassment' | 'incorrect_info' | 'copyright' | 'other'
  message text,
  status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  content_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, content_type, content_id)
);
```

### 3.4 Prepared-but-not-built (schema sketch only, per master prompt §38-40, 93-95)

No UI exists for any of these today - full DDL will be written when the
corresponding feature actually gets built, not before:

- `friends` (`user_id`, `friend_id`, `status: pending|accepted|blocked`)
- `leaderboards` (`user_id`, `game_id`, `period: global|weekly`, `score`, `rank`)
- `game_matches` / `match_players` / `game_results` (server-validated results only - §37, §95)
- `music` (`title`, `artist`, `source`, `license_status`, `duration`, `audio_url`)
- `recipes` (`ingredients jsonb`, `preparation`, `regional_variations jsonb`)
- `clothing_items`, `oimo_patterns`, `shyrdak_items` (same content shape as `culture_items`, split out only if they outgrow being a `culture_items.category`)
- `blocked_users`

---

## 4. Backend Plan

**Supabase**, per the master prompt's own default and this repo's existing
`AuthService` seam being designed for exactly this.

- **Auth**: Supabase Auth (email/password, built-in email verification +
  password-reset email delivery - both real gaps in `LocalAuthService`
  today). New `SupabaseAuthService implements AuthService` in
  `src/services/auth/`; swap the one import in `useAuthStore.ts`. Screens
  (`SignInScreen`, `SignUpScreen`, etc.) need zero changes.
- **Database**: Postgres, schema above, via `supabase-js`. Generate
  TypeScript types from the live schema (`supabase gen types typescript`)
  into `src/types/database.ts` rather than hand-writing them (§69).
- **Edge Functions** (Deno, `supabase/functions/`) for every
  server-authoritative write - this is the mechanism behind §11-17's
  "never trust the client": `claim-daily-task`, `award-xp` (internal,
  called by other functions, not client-invokable directly),
  `check-achievements`, `discover-culture-item`,
  `discover-explore-location`, `advance-quest`, `record-game-result`.
  Each function: validates the request, re-derives the reward server-side
  (never accepts a client-supplied XP/coin amount), writes via a
  `SECURITY DEFINER` Postgres function or the function's own
  service-role client, and returns the new authoritative state.
- **Storage**: buckets `avatars` (user-uploaded, private-by-default with
  signed URLs or public-read depending on the final privacy decision in
  §103-104), `culture`, `explore` (admin-uploaded CMS images, public-read).
  Existing bundled app assets stay bundled - Storage is only for *new*,
  admin-added, or user-uploaded content, not a migration of the whole
  `assets/` folder.
- **Realtime**: not needed for Phase 1-4. Revisit only if/when a live
  feature (multiplayer match state, live leaderboard) actually gets built.

---

## 5. Security Plan

- **RLS is on for every table with a `user_id` column, no exceptions.**
  Baseline owned-row policy:
  ```sql
  alter table user_progress enable row level security;
  create policy "own progress readable" on user_progress
    for select using (auth.uid() = user_id);
  -- No insert/update/delete policy for the client role at all on
  -- user_progress, xp_events, coin_transactions, user_achievements,
  -- daily_task_progress - writes only happen through SECURITY DEFINER
  -- functions/Edge Functions running as a privileged role. This is the
  -- literal enforcement of §11 ("never trust the client") - not a
  -- convention, a database-level guarantee.
  ```
- **Published content is public-read, unpublished is not**:
  ```sql
  create policy "published culture items are public" on culture_items
    for select using (status = 'published');
  create policy "editors can read all statuses" on culture_items
    for select using (exists (select 1 from admin_users where user_id = auth.uid()));
  ```
- **Admin tables**: readable/writable only via an `is_admin(role text[])`
  helper function checking `admin_users`, never by the general client role.
  `admin_audit_log` is insert-only for admins, never editable/deletable by
  anyone (append-only audit trail per §88).
- **Duplicate-claim protection**: primary-key/unique-constraint based
  wherever possible (`user_achievements(user_id, achievement_id)`,
  `daily_task_progress(user_id, task_id)` + `claimed_at is null` check),
  not just an application-level `if` check - matches §14/§109.
- **Secrets**: the mobile app only ever gets the Supabase project URL and
  the **anon/public key** (safe to ship in the app - it's meaningless
  without RLS, which is exactly why RLS is non-negotiable above). The
  **service-role key is never bundled into the app** - it only exists as
  an Edge Function environment secret, set via `supabase secrets set`,
  never committed, never placed in `.env` files the mobile app reads. This
  is the one credential in this whole plan that must never appear in
  chat, a commit, or client code - see the blocking question in §7.
- **Rate limiting** (§36): Supabase's own Auth rate limits cover
  login/signup/password-reset out of the box; custom sensitive endpoints
  (reward claims, support form) get a simple `count requests in the last
  N minutes` check inside the Edge Function itself.

---

## 6. Implementation Plan (phased, incremental - per master prompt §129)

Each phase below ends with: `tsc --noEmit`, `jest`, a live browser
verification pass (same methodology as every phase in `PROGRESS_AUDIT.md`
so far), and a `PROGRESS_AUDIT.md` write-up before moving to the next.
**Phase 6a cannot start without the decision in §7.**

| Phase | Scope |
|---|---|
| **6a** ✅ | Supabase project + `.env.example`, `SupabaseAuthService` swap-in, real email verification + password reset (magic links, not OTP codes - see PROGRESS_AUDIT.md), `profiles` table + RLS. **Done and verified live (2026-08-22)** - full writeup in `PROGRESS_AUDIT.md`. Note: `user_settings` wasn't part of this slice after all; it's still local (`useSettingsStore`) and rolls into 6b with the rest of per-user state. Environments (dev/staging/prod) also deferred - one project is being used for now, per the pragmatic default in §2; revisit before a real production launch. |
| **6b** | `user_progress`/`xp_events`/`coin_transactions`/`achievements`/`user_achievements`/`daily_tasks` + Edge Functions - migrate `useProgressStore` from local-authoritative to a thin client that calls Edge Functions and caches the server's response (react-query, finally put to use) |
| **6c** | `culture_categories`/`culture_items`/`explore_regions`/`explore_locations`/`quests` + seed migration from the existing hardcoded TS arrays (a 1:1 data migration, not new content) - Culture/Explore screens fetch instead of importing local `data.ts` |
| **6d** | Minimal admin panel (own app or route-gated within this one, TBD - see open question in §7) covering Users, Culture, Explore, Achievements, Daily Tasks, App Config - with RBAC (§87) and audit log (§88) from day one, not bolted on after |
| **6e** | Push notifications (Expo push token registration + an Edge Function trigger on notification-worthy events), deep-link-from-notification (§29-30) |
| **6f** | Analytics abstraction + Sentry crash reporting (§32-33) |
| **6g** | Storage (avatar upload, CMS image upload) + image validation (§44-46) |
| **6h** | Remote config/feature flags/maintenance mode/version gating (§25-27, 96-98) |
| **6i** | Security + E2E test suite (§72-75), CI/CD (§76), staging environment exercised end-to-end (§115) |
| **6j** | App store prep - bundle identifiers, permissions audit, icon/splash, store metadata (§78-82) |

Phases 6d onward are sequenced by dependency, not strict priority - happy
to reorder (e.g. push notifications before admin) based on what you want
working first.

---

## 7. Blocking decision - needs you, not me

Everything above this line is real planning work I could do without any
external input. **Phase 6a cannot start without a real Supabase project**,
and creating one is something I should not do on your behalf:

- Creating third-party accounts and entering credentials is outside what
  I'll do autonomously (this is a standing rule for me, not specific to
  Supabase) - you'd need to sign up / create the project yourself at
  supabase.com.
- Even once it exists, the **service-role key must never be pasted into
  this chat** - it's a secret with full database access, bypassing RLS
  entirely. The project URL and anon/public key *are* safe to share here
  (they're meant to ship inside the app). The service-role key should go
  directly from the Supabase dashboard into `supabase secrets set` (for
  Edge Functions) - I can walk you through that command without ever
  seeing the key's value.

See the question I'm asking alongside this document for the concrete next
step.
