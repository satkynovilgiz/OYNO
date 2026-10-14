import * as fs from 'fs';
import * as path from 'path';

const appDir = path.join(__dirname, '../app');

/** Does an Expo Router file exist for this route (static, index or dynamic segment)? Tests only. */
export function routeExists(route: string): boolean {
  const clean = route.split('?')[0].replace(/^\//, '');
  const segments = clean.split('/').filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    if (rest.length === 0) return fs.existsSync(path.join(dir, 'index.tsx'));
    const [head, ...tail] = rest;
    if (tail.length === 0 && fs.existsSync(path.join(dir, `${head}.tsx`))) return true;
    if (fs.existsSync(path.join(dir, head)) && fs.statSync(path.join(dir, head)).isDirectory() && walk(path.join(dir, head), tail)) return true;
    const dynamic = fs.readdirSync(dir).filter((name) => name.startsWith('['));
    return dynamic.some((name) => (tail.length === 0 && name.endsWith('.tsx')) || (!name.endsWith('.tsx') && walk(path.join(dir, name), tail)));
  };
  return walk(appDir, segments);
}
