/**
 * The read side of the E2E fake backend: a small, strict PostgREST subset
 * over the fixture tables. Pure (no Playwright), so the contract is unit
 * tested in fixtures/schema.test.ts and served by fixtures/backend.ts.
 *
 * Columns come ONLY from TABLE_SCHEMA. Fixture rows are checked against it
 * when the tables are built (an unknown key fails), and a schema column a
 * row leaves out reads as null - as PostgREST returns it. Anything outside
 * the supported subset fails with the table, the column and what is
 * supported, instead of being ignored.
 */
import { TABLE_SCHEMA, isMockedTable, type MockedTable } from './schema';

export type Row = Record<string, unknown>;
export type Tables = Record<MockedTable, Row[]>;

/** A request the fake backend refuses (reported as unexpected; fails the test). */
export class Unsupported extends Error {}

/** PostgREST filter operators implemented below. Others are unsupported. */
export const OPERATORS = ['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte'] as const;
const ORDER_MODIFIERS = ['asc', 'desc', 'nullsfirst', 'nullslast'];
const RESERVED = new Set(['select', 'order', 'limit', 'offset']);

const columnsOf = (table: MockedTable): readonly string[] => TABLE_SCHEMA[table];
const columnList = (table: MockedTable) => columnsOf(table).join(', ');

function requireColumn(table: MockedTable, column: string, where: string) {
  if (!columnsOf(table).includes(column)) {
    throw new Unsupported(`${table}: unknown column "${column}" in ${where} - ${table} columns (e2e/fixtures/schema.ts): ${columnList(table)}`);
  }
}

/**
 * Fixture tables checked against the schema: every fixture table must be a
 * mocked table (and vice versa), every row key a schema column. Rows are
 * completed with null for the schema columns they leave out.
 */
export function buildTables(fixtures: Record<string, Row[]>): Tables {
  const missingSchema = Object.keys(fixtures).filter((table) => !isMockedTable(table));
  if (missingSchema.length > 0) throw new Error(`fixture table(s) without a schema: ${missingSchema.join(', ')} - add their readable columns to TABLE_SCHEMA in e2e/fixtures/schema.ts`);
  const missingFixtures = Object.keys(TABLE_SCHEMA).filter((table) => !(table in fixtures));
  if (missingFixtures.length > 0) throw new Error(`mocked table(s) without fixture rows: ${missingFixtures.join(', ')} - add them to FIXTURE_TABLES in e2e/fixtures/data.ts (an empty array is fine)`);

  const tables = {} as Tables;
  for (const table of Object.keys(TABLE_SCHEMA) as MockedTable[]) {
    tables[table] = fixtures[table].map((row, index) => {
      const unknown = Object.keys(row).filter((key) => !columnsOf(table).includes(key));
      if (unknown.length > 0) throw new Error(`fixture ${table}[${index}] (id ${String(row.id ?? '?')}) has column(s) not in the schema: ${unknown.join(', ')} - ${table} columns: ${columnList(table)}`);
      return Object.fromEntries(columnsOf(table).map((column) => [column, column in row ? row[column] : null]));
    });
  }
  return tables;
}

function parseList(table: MockedTable, column: string, raw: string): string[] {
  if (!raw.startsWith('(') || !raw.endsWith(')')) throw new Unsupported(`${table}: malformed list in "${column}=in.${raw}" (expected in.(a,b))`);
  return raw.slice(1, -1).split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

const isNull = (value: unknown) => value === null || value === undefined;

function applyFilter(table: MockedTable, rows: Row[], column: string, raw: string): Row[] {
  const where = `filter "${column}=${raw}"`;
  // Logical trees and column-less keys reach here as "columns" too (or=, and=, not=): unknown column, refused.
  requireColumn(table, column, where);
  if (raw.startsWith('not.')) throw new Unsupported(`${table}: negated ${where} is not supported (operators: ${OPERATORS.join(', ')})`);
  const dot = raw.indexOf('.');
  const op = raw.slice(0, dot);
  const value = raw.slice(dot + 1);
  if (dot < 0 || !(OPERATORS as readonly string[]).includes(op)) throw new Unsupported(`${table}: unsupported operator in ${where} (operators: ${OPERATORS.join(', ')})`);
  switch (op) {
    case 'eq':
      return rows.filter((row) => !isNull(row[column]) && String(row[column]) === value);
    case 'neq':
      return rows.filter((row) => !isNull(row[column]) && String(row[column]) !== value);
    case 'in': {
      const values = parseList(table, column, value);
      return rows.filter((row) => !isNull(row[column]) && values.includes(String(row[column])));
    }
    case 'is':
      if (value === 'null') return rows.filter((row) => isNull(row[column]));
      if (value === 'true' || value === 'false') return rows.filter((row) => row[column] === (value === 'true'));
      throw new Unsupported(`${table}: unsupported ${where} (is.null, is.true, is.false)`);
    default: {
      const n = Number(value);
      const test = { gt: (c: number) => c > 0, gte: (c: number) => c >= 0, lt: (c: number) => c < 0, lte: (c: number) => c <= 0 }[op as 'gt'];
      return rows.filter((row) => !isNull(row[column]) && test(compare(row[column], Number.isFinite(n) && typeof row[column] === 'number' ? n : value)));
    }
  }
}

function applyOrder(table: MockedTable, rows: Row[], raw: string): Row[] {
  const terms = raw.split(',').map((term) => {
    const [column, ...modifiers] = term.split('.');
    requireColumn(table, column, `order "${raw}"`);
    for (const modifier of modifiers) if (!ORDER_MODIFIERS.includes(modifier)) throw new Unsupported(`${table}: unsupported order modifier "${modifier}" in "${raw}" (${ORDER_MODIFIERS.join(', ')})`);
    const desc = modifiers.includes('desc');
    // PostgREST default: nulls last for asc, first for desc.
    const nullsFirst = modifiers.includes('nullsfirst') || (desc && !modifiers.includes('nullslast'));
    return { column, desc, nullsFirst };
  });
  return [...rows].sort((a, b) => {
    for (const term of terms) {
      const av = a[term.column];
      const bv = b[term.column];
      if (isNull(av) !== isNull(bv)) return (isNull(av) ? 1 : -1) * (term.nullsFirst ? -1 : 1);
      const result = compare(av, bv) * (term.desc ? -1 : 1);
      if (result !== 0) return result;
    }
    return 0;
  });
}

function applySelect(table: MockedTable, rows: Row[], raw: string | null): Row[] {
  if (!raw || raw === '*') return rows;
  if (/[()!:]/.test(raw)) throw new Unsupported(`${table}: embedded resources, casts and aliases are not supported in select "${raw}"`);
  const columns = raw.split(',').map((column) => column.trim());
  for (const column of columns) requireColumn(table, column, `select "${raw}"`);
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
}

/** Range via ?limit/&offset or the Range header ("0-9"). */
function applyRange(table: MockedTable, rows: Row[], params: URLSearchParams, rangeHeader: string | undefined): { rows: Row[]; from: number } {
  let from = Number(params.get('offset') ?? 0);
  let to = params.has('limit') ? from + Number(params.get('limit')) - 1 : Infinity;
  if (rangeHeader) {
    const match = /^(\d+)-(\d+)$/.exec(rangeHeader);
    if (!match) throw new Unsupported(`${table}: unsupported Range header "${rangeHeader}" (expected "from-to")`);
    from = Number(match[1]);
    to = Math.min(to, Number(match[2]));
  }
  if (!Number.isInteger(from) || from < 0 || (to !== Infinity && !Number.isInteger(to))) throw new Unsupported(`${table}: invalid limit/offset "${params.get('limit')}"/"${params.get('offset')}"`);
  return { rows: rows.slice(from, to === Infinity ? undefined : to + 1), from };
}

export type ReadResponse = { status: number; body: unknown; headers: Record<string, string> };

/** A GET/HEAD on /rest/v1/<table>. Throws Unsupported for anything outside the contract. */
export function readTable(tables: Tables, table: string, params: URLSearchParams, headers: Record<string, string>, method: 'GET' | 'HEAD' = 'GET'): ReadResponse {
  if (!isMockedTable(table)) throw new Unsupported(`table "${table}" is not mocked - add its readable columns to TABLE_SCHEMA (e2e/fixtures/schema.ts) and rows to FIXTURE_TABLES (e2e/fixtures/data.ts)`);
  let rows = tables[table];
  for (const [key, raw] of params.entries()) if (!RESERVED.has(key)) rows = applyFilter(table, rows, key, raw);
  if (params.has('order')) rows = applyOrder(table, rows, params.get('order')!);
  const total = rows.length;
  const ranged = applyRange(table, rows, params, headers['range']);
  const selected = applySelect(table, ranged.rows, params.get('select'));
  const contentRange = `${selected.length ? `${ranged.from}-${ranged.from + selected.length - 1}` : '*'}/${(headers['prefer'] ?? '').includes('count=') ? total : '*'}`;
  if ((headers['accept'] ?? '').includes('vnd.pgrst.object')) {
    if (selected.length === 1) return { status: 200, body: selected[0], headers: { 'content-range': contentRange } };
    return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${selected.length} rows` }, headers: {} };
  }
  return { status: 200, body: method === 'HEAD' ? undefined : selected, headers: { 'content-range': contentRange } };
}
