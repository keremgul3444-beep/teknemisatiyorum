// Sunucunun gönderdiği hata, denetim kaydı ve bildirim anahtarlarının iki dilde de karşılığı olmalı.
import fs from 'fs';
import path from 'path';
import tr from '../src/i18n/tr.json';
import en from '../src/i18n/en.json';

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
}
const src = files(path.join(__dirname, '../../api/src')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const keys = new Set<string>();
for (const m of src.matchAll(/'((?:errors|audit|notif)\.[a-zA-Z_]+)'/g)) keys.add(m[1]);
// Errors.bad('X') / conflict('X') / tooMany('X') → errors.x
for (const m of src.matchAll(/Errors\.(?:bad|conflict|tooMany)\('([A-Z_]+)'/g)) keys.add(`errors.${m[1].toLowerCase()}`);
const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown> | undefined)?.[p], o);

test.each([...keys].sort())('%s iki dilde de çevrili', (k) => {
  expect(typeof get(tr, k)).toBe('string');
  expect(typeof get(en, k)).toBe('string');
});
