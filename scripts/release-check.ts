/**
 * OYNO release-readiness check - repository evidence only, reproducible.
 *
 *   npm run release:check                      # print the report
 *   npm run release:check -- --markdown docs/RELEASE_CHECK.md   # also write it
 *   npm run release:check -- --network        # + optional live reachability check
 *
 * Every check reports PASS, FAIL or UNKNOWN. Things a repository cannot
 * prove (Apple Developer portal, EAS/App Store credentials, which database
 * migrations are live, physical-device QA) stay UNKNOWN unless evidence is
 * recorded in docs/release-evidence.json - and even then they are shown as
 * "PASS (recorded evidence)", never as repository-verified.
 *
 * Never prints secret values (only whether a variable is set). Never
 * builds, submits, deploys or applies migrations. Exit code 1 if any FAIL.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Status = 'PASS' | 'FAIL' | 'UNKNOWN';
type Check = { group: string; name: string; status: Status; detail: string };

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const withNetwork = args.includes('--network');
const markdownIndex = args.indexOf('--markdown');
const markdownPath = markdownIndex >= 0 ? args[markdownIndex + 1] : null;
const checks: Check[] = [];
const add = (group: string, name: string, status: Status, detail: string) => checks.push({ group, name, status, detail });
const rel = (file: string) => path.join(ROOT, file);
const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(readFileSync(rel(file), 'utf8')) as T;
  } catch {
    return null;
  }
};
const get = (object: unknown, dotted: string): unknown => dotted.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), object);

function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Configuration (app.json)
// ---------------------------------------------------------------------
type AppJson = { expo: Record<string, unknown> };
const appJson = readJson<AppJson>('app.json');
const expo = appJson?.expo ?? null;
if (!expo) {
  add('Configuration', 'app.json readable', 'FAIL', 'app.json is missing or not valid JSON.');
} else {
  const required = ['name', 'slug', 'version', 'scheme', 'owner', 'ios.bundleIdentifier', 'android.package', 'extra.eas.projectId', 'runtimeVersion', 'updates.url'];
  const missing = required.filter((field) => get(expo, field) === undefined || get(expo, field) === '');
  add('Configuration', 'Required app.json fields', missing.length ? 'FAIL' : 'PASS', missing.length ? `Missing: ${missing.join(', ')} (add them to app.json "expo").` : `${required.length} fields present.`);

  const projectId = String(get(expo, 'extra.eas.projectId') ?? '');
  const updatesUrl = String(get(expo, 'updates.url') ?? '');
  add('Configuration', 'EAS Update URL matches project id', projectId && updatesUrl.endsWith(projectId) ? 'PASS' : 'FAIL', projectId && updatesUrl.endsWith(projectId) ? 'updates.url ends with extra.eas.projectId.' : 'Set updates.url to https://u.expo.dev/<extra.eas.projectId>.');

  const teamId = get(expo, 'ios.appleTeamId');
  add('Configuration', 'ios.appleTeamId set (needed to sign the widget extension)', teamId ? 'PASS' : 'FAIL', teamId ? 'Present.' : 'Missing: add your Apple Developer Team ID as expo.ios.appleTeamId in app.json.');

  // Every "./..." path in app.json must exist.
  const paths: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string' && node.startsWith('./')) paths.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(expo);
  const absent = paths.filter((file) => !existsSync(rel(file)));
  add('Configuration', 'Files referenced by app.json exist', absent.length ? 'FAIL' : 'PASS', absent.length ? `Missing: ${absent.join(', ')}` : `${paths.length} referenced files found.`);

  // Every config plugin must be an installed dependency.
  const pkg = readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>('package.json');
  const installed = new Set([...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})]);
  const plugins = (Array.isArray(expo.plugins) ? expo.plugins : []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)).filter((plugin): plugin is string => typeof plugin === 'string');
  const notInstalled = plugins.filter((plugin) => !plugin.startsWith('.') && !installed.has(plugin));
  add('Configuration', 'Config plugins are installed dependencies', notInstalled.length ? 'FAIL' : 'PASS', notInstalled.length ? `Not in package.json: ${notInstalled.join(', ')}` : `${plugins.length} plugins installed.`);
}

// ---------------------------------------------------------------------
// App icon (repository-checkable part only)
// ---------------------------------------------------------------------
async function checkIcon() {
  const icon = typeof expo?.icon === 'string' ? expo.icon : null;
  if (!icon || !existsSync(rel(icon))) return add('Assets', 'App icon 1024x1024, opaque', 'FAIL', 'expo.icon is missing or the file does not exist.');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Jimp } = require('jimp') as { Jimp: { read: (file: string) => Promise<{ width: number; height: number; bitmap: { data: Buffer } }> } };
    const image = await Jimp.read(rel(icon));
    let transparent = false;
    for (let i = 3; i < image.bitmap.data.length; i += 4) if (image.bitmap.data[i] < 255) {
      transparent = true;
      break;
    }
    const ok = image.width === 1024 && image.height === 1024 && !transparent;
    add('Assets', 'App icon 1024x1024, opaque', ok ? 'PASS' : 'FAIL', ok ? `${icon} is 1024x1024 with no transparency.` : `${icon} is ${image.width}x${image.height}${transparent ? ' and has transparent pixels' : ''}; App Store needs 1024x1024 opaque.`);
  } catch {
    add('Assets', 'App icon 1024x1024, opaque', 'UNKNOWN', 'Could not read the image (jimp unavailable or unreadable file).');
  }
  add('Assets', 'App icon is final OYNO artwork (not template art)', 'UNKNOWN', 'Needs a person to look at it - a script cannot judge artwork.');
}

// ---------------------------------------------------------------------
// Widget extension vs app (bundle id + App Group)
// ---------------------------------------------------------------------
function checkWidget() {
  const configFile = rel('targets/widget/expo-target.config.js');
  if (!existsSync(configFile)) return add('Widget', 'Widget target config', 'UNKNOWN', 'No targets/widget - nothing to check.');
  const appId = String(get(expo, 'ios.bundleIdentifier') ?? '');
  const appGroups = (get(expo, 'ios.entitlements') as Record<string, unknown> | undefined)?.['com.apple.security.application-groups'];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const factory = require(configFile) as (config: unknown) => { bundleIdentifier: string; entitlements?: Record<string, unknown> };
    const target = factory({ ios: { entitlements: get(expo, 'ios.entitlements') ?? {} } });
    const widgetId = target.bundleIdentifier.startsWith('.') ? `${appId}${target.bundleIdentifier}` : target.bundleIdentifier;
    add('Widget', 'Widget bundle id is under the app bundle id', widgetId.startsWith(`${appId}.`) ? 'PASS' : 'FAIL', `${widgetId} (app: ${appId}).`);
    // Same derivation as targets/widget/OYNOWidgetData.swift and src/services/widgets/widgetBridge.ts.
    const derived = `group.${widgetId.split('.').slice(0, -1).join('.')}.widgets`;
    const groups = Array.isArray(appGroups) ? appGroups.map(String) : [];
    const widgetGroups = (target.entitlements?.['com.apple.security.application-groups'] as unknown[] | undefined)?.map(String) ?? [];
    const agree = groups.includes(derived) && widgetGroups.includes(derived) && groups.some((group) => group.endsWith('.widgets'));
    add('Widget', 'App Group agrees (app entitlement, widget entitlement, Swift + JS derivation)', agree ? 'PASS' : 'FAIL', agree ? derived : `Expected ${derived}; app has [${groups.join(', ')}], widget has [${widgetGroups.join(', ')}].`);
  } catch (error) {
    add('Widget', 'Widget target config', 'FAIL', `Could not evaluate expo-target.config.js: ${(error as Error).message}`);
  }
}

// ---------------------------------------------------------------------
// EAS build / update profiles
// ---------------------------------------------------------------------
function checkEas() {
  type Profile = { extends?: string; channel?: string; environment?: string; distribution?: string; autoIncrement?: boolean; developmentClient?: boolean };
  const eas = readJson<{ cli?: { version?: string; appVersionSource?: string }; build?: Record<string, Profile> }>('eas.json');
  if (!eas?.build) return add('EAS', 'eas.json readable', 'FAIL', 'eas.json is missing or has no "build" profiles.');
  const profiles = Object.entries(eas.build).filter(([, profile]) => profile.channel !== undefined || profile.extends !== undefined);
  const noChannel = profiles.filter(([, profile]) => !profile.channel).map(([name]) => name);
  const channels = profiles.map(([, profile]) => profile.channel).filter(Boolean);
  const duplicate = channels.filter((channel, index) => channels.indexOf(channel) !== index);
  const extendsMissing = profiles.filter(([, profile]) => profile.extends && !eas.build![profile.extends]).map(([name]) => name);
  const problems = [
    ...(noChannel.length ? [`no channel: ${noChannel.join(', ')}`] : []),
    ...(duplicate.length ? [`duplicate channels: ${duplicate.join(', ')}`] : []),
    ...(extendsMissing.length ? [`extends an unknown profile: ${extendsMissing.join(', ')}`] : []),
    ...(!eas.cli?.version ? ['cli.version missing'] : []),
  ];
  add('EAS', 'Build profiles consistent (channels unique, extends valid)', problems.length ? 'FAIL' : 'PASS', problems.length ? problems.join('; ') : profiles.map(([name, profile]) => `${name}->${profile.channel}`).join(', '));
  const production = eas.build.production;
  add('EAS', 'Production profile auto-increments build numbers', production?.autoIncrement || eas.cli?.appVersionSource === 'remote' ? 'PASS' : 'FAIL', production ? `autoIncrement=${String(production.autoIncrement)}, appVersionSource=${eas.cli?.appVersionSource ?? 'local'}` : 'No production profile.');
  const runtime = get(expo, 'runtimeVersion');
  add('EAS', 'Updates use a runtime-version policy', runtime ? 'PASS' : 'FAIL', `runtimeVersion=${JSON.stringify(runtime)} - an update only reaches builds with the same runtime.`);
  add('EAS', 'Which update branch each channel points to', 'UNKNOWN', 'Lives in the EAS project, not the repo: check with `eas channel:list`.');
}

// ---------------------------------------------------------------------
// Native modules that need a NEW build (must be documented)
// ---------------------------------------------------------------------
function checkNativeDocs() {
  const REQUIRES_REBUILD: Record<string, string> = { 'expo-print': 'docs/TESTFLIGHT_READINESS.md' };
  const pkg = readJson<{ dependencies?: Record<string, string> }>('package.json');
  for (const [module, doc] of Object.entries(REQUIRES_REBUILD)) {
    if (!pkg?.dependencies?.[module]) continue;
    const documented = existsSync(rel(doc)) && readFileSync(rel(doc), 'utf8').includes(module);
    add('Native modules', `${module} rebuild requirement documented`, documented ? 'PASS' : 'FAIL', documented ? `Mentioned in ${doc}.` : `Add a note to ${doc}: ${module} needs a new native build.`);
  }
}

// ---------------------------------------------------------------------
// Environment variables (names only - never values)
// ---------------------------------------------------------------------
function checkEnv() {
  const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  const OPTIONAL = ['EXPO_PUBLIC_SENTRY_DSN'];
  const example = existsSync(rel('.env.example')) ? readFileSync(rel('.env.example'), 'utf8') : '';
  const undocumented = [...REQUIRED, ...OPTIONAL].filter((name) => !new RegExp(`^${name}=`, 'm').test(example));
  add('Environment', '.env.example documents every variable', undocumented.length ? 'FAIL' : 'PASS', undocumented.length ? `Not in .env.example: ${undocumented.join(', ')}` : `${REQUIRED.length + OPTIONAL.length} variables documented.`);
  const dotenv = existsSync(rel('.env')) ? readFileSync(rel('.env'), 'utf8') : '';
  const isSet = (name: string) => !!process.env[name] || new RegExp(`^${name}=\\S+`, 'm').test(dotenv);
  const missing = REQUIRED.filter((name) => !isSet(name));
  add('Environment', 'Required variables set locally (values not shown)', missing.length ? 'FAIL' : 'PASS', missing.length ? `Not set: ${missing.join(', ')}. Copy .env.example to .env and fill them in (Supabase project settings -> API).` : 'Set (via environment or .env).');
}

// ---------------------------------------------------------------------
// CI + migrations
// ---------------------------------------------------------------------
function checkCiAndMigrations() {
  const ci = existsSync(rel('.github/workflows/ci.yml')) ? readFileSync(rel('.github/workflows/ci.yml'), 'utf8') : '';
  const runs = ['npx tsc --noEmit', 'npx jest'].filter((command) => ci.includes(command));
  add('CI', 'CI runs typecheck and tests', runs.length === 2 ? 'PASS' : 'FAIL', runs.length === 2 ? '.github/workflows/ci.yml runs tsc and jest.' : 'Add `npx tsc --noEmit` and `npx jest --ci` to .github/workflows/ci.yml.');
  add('CI', 'Latest CI run on GitHub is green', 'UNKNOWN', 'Not visible from the repo: check the Actions tab for this commit.');

  const dir = rel('supabase/migrations');
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.sql')).sort() : [];
  const badNames = files.filter((file) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(file));
  add('Database', 'Migration files well-formed and ordered', badNames.length ? 'FAIL' : 'PASS', badNames.length ? `Unexpected names: ${badNames.join(', ')}` : `${files.length} migrations, newest ${files[files.length - 1] ?? '-'}.`);
  const pending = files.filter((file) => /NOT applied/i.test(readFileSync(path.join(dir, file), 'utf8')));
  add('Database', 'Migrations applied to the live project', 'UNKNOWN', pending.length ? `Cannot be verified from the repo. Marked "not applied" in the file: ${pending.join(', ')}.` : 'Cannot be verified from the repo - check the Supabase dashboard migration history.');
}

// ---------------------------------------------------------------------
// External accounts + devices: UNKNOWN unless evidence is recorded
// ---------------------------------------------------------------------
function checkExternal() {
  type Evidence = Record<string, { status?: string; evidence?: string; date?: string; by?: string }>;
  const evidence = readJson<Evidence>('docs/release-evidence.json') ?? {};
  const EXTERNAL: [string, string][] = [
    ['apple-portal', 'Apple Developer: App IDs (app + widget), App Group, Push capability registered'],
    ['eas-credentials', 'EAS iOS credentials / provisioning profiles for both targets'],
    ['sign-in-with-apple', 'Sign in with Apple decision (App Review 4.8) configured in Supabase'],
    ['live-migrations', 'All required migrations applied to the live Supabase project'],
    ['device-qa', 'Physical-device QA (docs/DEVICE_QA.md) completed on a named build'],
    ['testflight-build', 'An iOS build exists and installs via TestFlight'],
  ];
  for (const [id, name] of EXTERNAL) {
    const record = evidence[id];
    const ok = record?.status === 'PASS' && !!record.evidence && !!record.date;
    add('External (not repo-verifiable)', name, ok ? 'PASS' : 'UNKNOWN', ok ? `Recorded evidence (${record!.date}${record!.by ? `, ${record!.by}` : ''}): ${record!.evidence}` : `No evidence recorded. Add {"${id}": {"status": "PASS", "evidence": "...", "date": "YYYY-MM-DD"}} to docs/release-evidence.json once done.`);
  }
}

// ---------------------------------------------------------------------
// Optional network check
// ---------------------------------------------------------------------
async function checkNetwork() {
  if (!withNetwork) return add('Network (optional)', 'Supabase auth settings reachable', 'UNKNOWN', 'Skipped - run with --network to check.');
  const dotenv = existsSync(rel('.env')) ? readFileSync(rel('.env'), 'utf8') : '';
  const read = (name: string) => process.env[name] ?? new RegExp(`^${name}=(\\S+)`, 'm').exec(dotenv)?.[1] ?? null;
  const url = read('EXPO_PUBLIC_SUPABASE_URL');
  const key = read('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) return add('Network (optional)', 'Supabase auth settings reachable', 'UNKNOWN', 'Environment variables not set - see Environment checks.');
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(10_000) });
    add('Network (optional)', 'Supabase auth settings reachable', response.ok ? 'PASS' : 'FAIL', response.ok ? 'HTTP 200.' : `HTTP ${response.status} - check the URL / anon key.`);
  } catch {
    add('Network (optional)', 'Supabase auth settings reachable', 'UNKNOWN', 'Network unavailable - this is not a failure of the project.');
  }
}

async function main() {
  checkWidget();
  checkEas();
  checkNativeDocs();
  checkEnv();
  checkCiAndMigrations();
  await checkIcon();
  checkExternal();
  await checkNetwork();

  const sha = git('rev-parse HEAD') ?? 'unknown (not a git checkout)';
  const dirty = git('status --porcelain');
  const date = new Date().toISOString();
  const counts = { PASS: 0, FAIL: 0, UNKNOWN: 0 };
  for (const check of checks) counts[check.status] += 1;

  const lines = [
    '# OYNO release check',
    '',
    `Commit: \`${sha}\`${dirty ? ' (with uncommitted changes)' : ''}`,
    `Run at: ${date}`,
    `Result: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.UNKNOWN} UNKNOWN`,
    '',
    'Generated by `npm run release:check`. Re-run to refresh; values are never printed.',
    '',
    '| Group | Check | Status | Detail |',
    '| --- | --- | --- | --- |',
    ...checks.map((check) => `| ${check.group} | ${check.name} | **${check.status}** | ${check.detail.replace(/\|/g, '\\|')} |`),
    '',
  ];
  const text = lines.join('\n');
  // eslint-disable-next-line no-console
  console.log(text);
  if (markdownPath) writeFileSync(path.resolve(ROOT, markdownPath), text);
  process.exitCode = counts.FAIL > 0 ? 1 : 0;
}

void main();
