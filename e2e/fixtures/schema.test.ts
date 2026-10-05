import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { FIXTURE_TABLES } from './data';
import { migrationTables, readableColumns } from './migrationColumns';
import { buildTables, readTable, Unsupported, type Row } from './postgrest';
import { TABLE_SCHEMA, type MockedTable } from './schema';

/**
 * The E2E fake backend's query contract (TABLE_SCHEMA) against its sources:
 * the repository migrations and the app's content queries. And the contract
 * itself: queries are judged by the schema, never by the fixture rows.
 * (Not a substitute for integration tests against a real Supabase.)
 */
const ROOT = join(__dirname, '..', '..');
const MOCKED = Object.keys(TABLE_SCHEMA) as MockedTable[];
const tables = buildTables(FIXTURE_TABLES);
const read = (table: string, query: string, headers: Record<string, string> = {}, source = tables) => readTable(source, table, new URLSearchParams(query), headers);
const ids = (response: { body: unknown }) => (response.body as Row[]).map((row) => row.id);
const refusal = (table: string, query: string, source = tables) => {
  try {
    read(table, query, {}, source);
  } catch (error) {
    if (error instanceof Unsupported) return error.message;
    throw error;
  }
  throw new Error(`expected ${table}?${query} to be refused`);
};

describe('schema sources', () => {
  const migrations = migrationTables(join(ROOT, 'supabase', 'migrations'));

  it.each(MOCKED)('%s matches the readable columns in supabase/migrations', (table) => {
    const migration = migrations.get(table);
    expect(migration).toBeDefined();
    expect({ table, columns: [...TABLE_SCHEMA[table]].sort() }).toEqual({ table, columns: readableColumns(migration!) });
  });

  it('column grants are honoured (region_content_links.updated_by is not readable)', () => {
    expect(migrations.get('region_content_links')!.columns.has('updated_by')).toBe(true);
    expect(TABLE_SCHEMA.region_content_links).not.toContain('updated_by');
  });

  // Every `.from('<mocked table>')` chain in src/services: its select / filter / order columns exist in the schema.
  const queries: { file: string; table: string; columns: string[] }[] = [];
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return walk(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  for (const file of walk(join(ROOT, 'src', 'services'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\.from\('(\w+)'\)([^;]*)/g)) {
      const table = match[1];
      if (!(table in TABLE_SCHEMA)) continue;
      const chain = match[2];
      const columns = [
        ...[...chain.matchAll(/\.select\('([^']*)'/g)].flatMap((select) => select[1].split(',').map((column) => column.trim())).filter((column) => column !== '*'),
        ...[...chain.matchAll(/\.(?:eq|neq|in|is|gt|gte|lt|lte|order)\('(\w+)'/g)].map((filter) => filter[1]),
      ];
      queries.push({ file: relative(ROOT, file), table, columns });
    }
  }

  it('finds the content queries (sanity)', () => {
    expect(queries.length).toBeGreaterThanOrEqual(10);
  });

  it('every mocked table is read by the app', () => {
    expect(MOCKED.filter((table) => !queries.some((query) => query.table === table))).toEqual([]);
  });

  it('content queries use only schema columns', () => {
    const problems = queries.flatMap((query) =>
      query.columns.filter((column) => !(TABLE_SCHEMA[query.table as MockedTable] as readonly string[]).includes(column)).map((column) => `${query.file}: ${query.table}.${column}`),
    );
    expect(problems).toEqual([]);
  });
});

describe('fixture rows are validated against the schema', () => {
  it('the shipped fixtures fit', () => {
    expect(() => buildTables(FIXTURE_TABLES)).not.toThrow();
  });

  it('a fixture table without a schema fails clearly', () => {
    expect(() => buildTables({ ...FIXTURE_TABLES, user_progress: [] })).toThrow(/user_progress.*TABLE_SCHEMA in e2e\/fixtures\/schema\.ts/);
  });

  it('a mocked table without fixture rows fails clearly', () => {
    const { quests: _quests, ...rest } = FIXTURE_TABLES;
    expect(() => buildTables(rest)).toThrow(/quests.*FIXTURE_TABLES/);
  });

  it('a row with a column outside the schema fails with table, row and column', () => {
    const rows = [{ ...FIXTURE_TABLES.culture_categories[0], colour: 'red' }];
    expect(() => buildTables({ ...FIXTURE_TABLES, culture_categories: rows })).toThrow(/culture_categories\[0\] \(id boz-uy\).*colour/);
  });
});

describe('query contract', () => {
  it('empty tables answer valid queries with no rows and still refuse unknown columns', () => {
    expect(read('quest_steps', 'select=*&quest_id=eq.lost-shyrdak&order=step_order.asc').body).toEqual([]);
    expect(read('content_translations', 'select=content_type,content_id,language,field,value').body).toEqual([]);
    expect(refusal('quest_steps', 'select=*&quest=eq.lost-shyrdak')).toMatch(/quest_steps: unknown column "quest" in filter.*quest_steps columns/);
    expect(refusal('discoveries', 'select=*&order=rank')).toMatch(/discoveries: unknown column "rank" in order/);
  });

  it('a filter that already matched nothing does not let an unknown column through', () => {
    expect(read('culture_items', 'id=eq.missing').body).toEqual([]);
    expect(refusal('culture_items', 'id=eq.missing&no_such_column=eq.1')).toMatch(/culture_items: unknown column "no_such_column"/);
    expect(refusal('culture_items', 'id=eq.missing&select=id,no_such_column')).toMatch(/in select/);
  });

  it('a schema column a fixture row leaves out reads as null and can be filtered and ordered', () => {
    const source = buildTables({
      ...FIXTURE_TABLES,
      culture_categories: [{ id: 'a', title: 'A', sort_order: 1 }, { id: 'b', title: 'B' }],
    });
    expect(read('culture_categories', 'select=id,sort_order&order=id.asc', {}, source).body).toEqual([
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: null },
    ]);
    expect(ids(read('culture_categories', 'sort_order=is.null', {}, source))).toEqual(['b']);
    expect(ids(read('culture_categories', 'sort_order=eq.1', {}, source))).toEqual(['a']);
    // Postgres defaults: nulls last ascending, first descending.
    expect(ids(read('culture_categories', 'order=sort_order.asc', {}, source))).toEqual(['a', 'b']);
    expect(ids(read('culture_categories', 'order=sort_order.desc', {}, source))).toEqual(['b', 'a']);
  });

  it('changing fixture data does not change which queries are accepted', () => {
    const emptied = buildTables(Object.fromEntries(MOCKED.map((table) => [table, []])));
    // A column no fixture row carries, on a table with no rows at all.
    const valid = ['culture_items|select=simple_summary_en,update_note&order=published_at.desc', 'explore_regions|select=*&sources=is.null', 'culture_categories|title=neq.x'];
    const invalid = ['culture_items|select=colour', 'explore_regions|order=population', 'culture_categories|parent=eq.x'];
    for (const source of [tables, emptied]) {
      for (const query of valid) expect(() => read(query.split('|')[0], query.split('|')[1], {}, source)).not.toThrow();
      for (const query of invalid) expect(() => read(query.split('|')[0], query.split('|')[1], {}, source)).toThrow(Unsupported);
    }
  });

  it('unsupported PostgREST syntax is refused explicitly', () => {
    expect(refusal('culture_items', 'or=(id.eq.a,id.eq.b)')).toMatch(/unknown column "or"/);
    expect(refusal('culture_items', 'title=like.*a*')).toMatch(/unsupported operator.*eq, neq, in, is, gt, gte, lt, lte/);
    expect(refusal('culture_items', 'title=not.eq.a')).toMatch(/negated filter/);
    expect(refusal('culture_items', 'select=*,culture_categories(*)')).toMatch(/embedded resources/);
    expect(refusal('culture_items', 'select=id::text')).toMatch(/casts and aliases/);
    expect(refusal('culture_items', 'id=in.a,b')).toMatch(/malformed list/);
    expect(refusal('culture_items', 'order=id.random')).toMatch(/order modifier "random"/);
    expect(() => read('culture_items', 'select=id', { range: 'all' })).toThrow(/Range header "all"/);
    expect(refusal('user_progress', 'select=*')).toMatch(/table "user_progress" is not mocked/);
  });

  it('filtering, ordering and pagination behave like PostgREST', () => {
    expect(ids(read('culture_items', 'select=id&category_id=eq.boz-uy&order=sort_order.desc'))).toEqual(['boz-uy-tunduk', 'boz-uy-karkas', 'boz-uy-overview']);
    expect(ids(read('culture_items', 'select=id&order=sort_order.asc&limit=2&offset=1'))).toEqual(['boz-uy-karkas', 'boz-uy-tunduk']);
    const ranged = read('culture_items', 'select=id&order=sort_order.asc', { range: '3-4', prefer: 'count=exact' });
    expect(ids(ranged)).toEqual(['shyrdak-craft', 'oymo-overview']);
    expect(ranged.headers['content-range']).toBe('3-4/5');
    expect(read('culture_items', 'id=eq.boz-uy-tunduk&select=id', { accept: 'application/vnd.pgrst.object+json' }).body).toEqual({ id: 'boz-uy-tunduk' });
    expect(read('culture_items', 'id=eq.missing', { accept: 'application/vnd.pgrst.object+json' }).status).toBe(406);
  });
});
