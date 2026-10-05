/**
 * Columns of public tables as the repository migrations define them, for the
 * E2E backend contract test (fixtures/schema.test.ts). A deliberately small
 * parser for the statements this repository uses: CREATE TABLE, ALTER TABLE
 * ADD / DROP / RENAME COLUMN, and column-level `grant select (...)` (which
 * narrows what the app can read). Anything it does not understand about a
 * mocked table is an error, not a guess.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONSTRAINT_START = /^(constraint|primary\s+key|unique|check|foreign\s+key|exclude)\b/i;

/** Split on commas that are not inside parentheses or quotes. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = false;
  let current = '';
  for (const char of body) {
    if (char === "'") quote = !quote;
    if (!quote && char === '(') depth += 1;
    if (!quote && char === ')') depth -= 1;
    if (!quote && depth === 0 && char === ',') {
      parts.push(current);
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Text of a parenthesised block starting at `open` (index of "("). */
function block(sql: string, open: number): string {
  let depth = 0;
  let quote = false;
  for (let index = open; index < sql.length; index += 1) {
    const char = sql[index];
    if (char === "'") quote = !quote;
    if (quote) continue;
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(open + 1, index);
    }
  }
  throw new Error('unbalanced parentheses');
}

const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Function bodies ($$ ... $$) can contain table-like text - drop them. */
const stripFunctionBodies = (sql: string) => sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''");

export type MigrationTable = { columns: Set<string>; readable: Set<string> | null; sources: string[] };

export function migrationTables(migrationsDir: string): Map<string, MigrationTable> {
  const tables = new Map<string, MigrationTable>();
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = stripFunctionBodies(stripComments(readFileSync(join(migrationsDir, file), 'utf8')));
    const touch = (name: string) => {
      const table = tables.get(name);
      if (!table) throw new Error(`${file}: ALTER/GRANT on ${name} before CREATE TABLE`);
      if (!table.sources.includes(file)) table.sources.push(file);
      return table;
    };

    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(/gi)) {
      const name = match[1].toLowerCase();
      const columns = new Set<string>();
      for (const part of splitTopLevel(block(sql, match.index! + match[0].length - 1))) {
        if (CONSTRAINT_START.test(part)) continue;
        columns.add(part.split(/\s+/)[0].replace(/"/g, '').toLowerCase());
      }
      tables.set(name, { columns, readable: null, sources: [file] });
    }

    for (const match of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?(\w+)\s+([\s\S]*?);/gi)) {
      const name = match[1].toLowerCase();
      const actions = splitTopLevel(match[2]);
      for (const action of actions) {
        const add = /^add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/i.exec(action);
        const drop = /^drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/i.exec(action);
        const rename = /^rename\s+column\s+"?(\w+)"?\s+to\s+"?(\w+)"?/i.exec(action);
        if (!add && !drop && !rename) continue; // constraints, RLS, defaults, owners...
        const table = touch(name);
        if (add) table.columns.add(add[1].toLowerCase());
        if (drop) table.columns.delete(drop[1].toLowerCase());
        if (rename) {
          if (!table.columns.delete(rename[1].toLowerCase())) throw new Error(`${file}: rename of unknown column ${name}.${rename[1]}`);
          table.columns.add(rename[2].toLowerCase());
        }
      }
    }

    for (const match of sql.matchAll(/grant\s+select\s*\(([^)]*)\)\s*on\s+(?:table\s+)?(?:public\.)?(\w+)\s+to\s+([^;]+);/gi)) {
      if (!/\banon\b/i.test(match[3])) continue;
      const table = touch(match[2].toLowerCase());
      table.readable = new Set(match[1].split(',').map((column) => column.trim().replace(/"/g, '').toLowerCase()));
    }
  }
  return tables;
}

/** What the anon client can read: the column grant when there is one, else every column. */
export function readableColumns(table: MigrationTable): string[] {
  return [...(table.readable ?? table.columns)].sort();
}
