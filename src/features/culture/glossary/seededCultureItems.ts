import * as fs from 'fs';
import * as path from 'path';

/**
 * TEST HELPER: the culture_items rows as seeded by the repo's migrations
 * (inserts, then later `update ... set field = '...'` statements, in
 * filename order) - an offline view of the content source of truth.
 * Only quoted text / null values are read; anything else stays raw.
 */
type Row = Record<string, string | null>;

function readLiteral(sql: string, start: number): { value: string; end: number } {
  let value = '';
  let i = start + 1;
  for (;;) {
    const ch = sql[i];
    if (ch === "'") {
      if (sql[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return { value, end: i + 1 };
    }
    value += ch;
    i += 1;
  }
}

/** Splits "a, 'b, c', array[...], (x)" at top-level commas into raw parts. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'") {
      const literal = readLiteral(body, i);
      current += body.slice(i, literal.end);
      i = literal.end - 1;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function valueOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^null$/i.test(trimmed)) return null;
  if (trimmed.startsWith("'")) return readLiteral(trimmed, 0).value;
  return trimmed;
}

/** Top-level parenthesised tuples after VALUES, up to the closing ';'. */
function tuples(sql: string, from: number): { tuples: string[]; end: number } {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = from; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      i = readLiteral(sql, i).end - 1;
      continue;
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) found.push(sql.slice(start, i));
    } else if (ch === ';' && depth === 0) return { tuples: found, end: i };
  }
  return { tuples: found, end: sql.length };
}

export function seededCultureItems(root: string): Map<string, Row> {
  const dir = path.join(root, 'supabase/migrations');
  const rows = new Map<string, Row>();
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const statement = /insert into public\.culture_items\s*\(([^)]*)\)\s*values/gi;
    let match: RegExpExecArray | null;
    while ((match = statement.exec(sql))) {
      const columns = match[1].split(',').map((column) => column.trim());
      const { tuples: found } = tuples(sql, statement.lastIndex);
      for (const tuple of found) {
        const values = splitTopLevel(tuple).map(valueOf);
        const row: Row = {};
        columns.forEach((column, index) => (row[column] = values[index] ?? null));
        if (row.id) rows.set(row.id, { ...(rows.get(row.id) ?? {}), ...row });
      }
    }
    const update = /update public\.culture_items\s+set\s+([\s\S]*?)\s+where id = '([^']+)';/gi;
    while ((match = update.exec(sql))) {
      const existing = rows.get(match[2]);
      if (!existing) continue;
      for (const assignment of splitTopLevel(match[1])) {
        const eq = assignment.indexOf('=');
        if (eq < 0) continue;
        const column = assignment.slice(0, eq).trim();
        const raw = assignment.slice(eq + 1).trim();
        if (raw.startsWith("'") || /^null$/i.test(raw)) existing[column] = valueOf(raw);
      }
    }
  }
  return rows;
}
