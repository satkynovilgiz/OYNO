import * as fs from 'fs';
import * as path from 'path';

/**
 * A zustand selector that returns a NEW array/object on every call (e.g.
 * `state.list[owner] ?? []`) makes React re-render forever and the screen
 * crashes ("Something went wrong"). Fallbacks must be module constants.
 */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

it('no store selector returns a fresh [] or {} fallback', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(path.join(__dirname, '..'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/use[A-Za-z]+Store\(\(state\) => [^;\n]*?\?\? (\[\]|\{\})\)/g)) offenders.push(`${path.relative(path.join(__dirname, '..'), file)}: ${match[0]}`);
  }
  expect(offenders).toEqual([]);
});
