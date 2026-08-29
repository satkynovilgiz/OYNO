import fs from 'fs';
import path from 'path';

/**
 * Static lint over every migration file, not a live-DB check (this repo
 * has no way to run one in CI - see BACKEND_PLAN.md/this session's own
 * notes on why the Supabase CLI can't link in this environment). Encodes
 * the two security invariants this project's own migration comments state
 * as rules on every single table/function, repeatedly, by hand - this
 * makes them enforced instead of just documented, catching the exact
 * regression class of "added a new table and forgot RLS" or "added a new
 * admin_ function and forgot the role check" before it ships.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations');

function readAllMigrations(): string {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  return files.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n');
}

// Tables that are allowed a direct client-facing RLS write policy (insert/
// update/delete) because there's nothing to cheat: user preferences,
// append-only client analytics, and the purely cosmetic avatar config -
// not economy/progress/security state.
const ALLOWED_CLIENT_WRITE_TABLES = new Set(['user_settings', 'analytics_events', 'user_avatars']);

// Tables where a client write policy would be a real security hole -
// every mutation must go through a SECURITY DEFINER function instead.
const MUST_NOT_HAVE_CLIENT_WRITE_POLICY = [
  'user_progress',
  'user_game_stats',
  'user_achievements',
  'user_discoveries',
  'xp_events',
  'coin_transactions',
  'push_tokens',
  'admin_roles',
  'admin_audit_log',
  'culture_quiz_questions',
];

describe('database security invariants (static migration lint)', () => {
  const sql = readAllMigrations();

  it('every created table has row level security enabled', () => {
    const createdTables = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((m) => m[1]);
    expect(createdTables.length).toBeGreaterThan(0); // sanity: the regex itself still matches something

    const rlsEnabledTables = new Set(
      [...sql.matchAll(/alter table public\.([a-z_]+) enable row level security/g)].map((m) => m[1]),
    );

    const missing = [...new Set(createdTables)].filter((t) => !rlsEnabledTables.has(t));
    expect(missing).toEqual([]);
  });

  it.each(MUST_NOT_HAVE_CLIENT_WRITE_POLICY)('%s has no client-facing insert/update/delete policy', (table) => {
    const policyRe = new RegExp(`create policy "[^"]*" on public\\.${table} for (insert|update|delete)`, 'g');
    const matches = [...sql.matchAll(policyRe)];
    expect(matches).toEqual([]);
  });

  it('ALLOWED_CLIENT_WRITE_TABLES and MUST_NOT_HAVE_CLIENT_WRITE_POLICY do not overlap', () => {
    // Guards the test itself against someone "fixing" a failure by quietly
    // moving a table to the allowlist instead of fixing the real issue.
    const overlap = MUST_NOT_HAVE_CLIENT_WRITE_POLICY.filter((t) => ALLOWED_CLIENT_WRITE_TABLES.has(t));
    expect(overlap).toEqual([]);
  });

  it('every admin_* SECURITY DEFINER function calls require_admin_role', () => {
    // Anchored on the literal "as $$" that immediately precedes every
    // function body in this codebase's convention, not just "\n$$" - the
    // latter also matches a *closing* "$$;" (also newline-preceded),
    // which silently paired each function with its predecessor's tail
    // instead of its own body. Caught by this test's own false positive
    // on admin_delete_quiz_question before this anchor was fixed.
    const fnRe = /create function public\.(admin_[a-z_]+)\([^)]*\)[\s\S]*?as \$\$\n([\s\S]*?)\n\$\$;/g;
    const functions = [...sql.matchAll(fnRe)];
    expect(functions.length).toBeGreaterThan(0);

    const ungated = functions.filter(([, , body]) => !body.includes('require_admin_role(')).map(([, name]) => name);
    expect(ungated).toEqual([]);
  });

  it('every top-level user-facing action function derives its identity from auth.uid(), never a client-supplied user id', () => {
    // Every RPC callable by `authenticated` that isn't an admin_* function
    // should read auth.uid() itself rather than accepting a p_user_id
    // parameter - the latter would let one user act as another. Internal
    // helpers (apply_reward, apply_daily_reset, check_achievements) are
    // exempt: they take a user_id on purpose but are revoked from
    // authenticated/anon (see progress.sql's own comment), so a client can
    // never call them directly with an arbitrary id.
    const grantedFns = [...sql.matchAll(/grant execute on function public\.([a-z_]+)\(([^)]*)\) to authenticated/g)];
    expect(grantedFns.length).toBeGreaterThan(0);

    const suspicious = grantedFns
      .filter(([, name]) => !name.startsWith('admin_'))
      .filter(([, , params]) => /p_user_id/.test(params))
      .map(([, name]) => name);

    expect(suspicious).toEqual([]);
  });
});
