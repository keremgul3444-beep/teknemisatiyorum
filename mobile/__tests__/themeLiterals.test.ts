import fs from 'fs';
import path from 'path';

// Yazı tipi ve köşe yarıçapı değerleri temadan gelmeli (tasarım belgesi §4).
test('ekran ve bileşenlerde sabit yazı tipi adı ya da sayısal köşe yarıçapı yok', () => {
  const files: string[] = [];
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.tsx') && files.push(path.join(d, e.name)));
  ['src/app', 'src/components'].forEach((d) => walk(path.join(__dirname, '..', d)));
  const offenders = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /['"](Figtree|BricolageGrotesque|Inter|SpaceGrotesk)_\w+['"]|borderRadius: \d/.test(line))
    .map(({ i }) => `${path.relative(process.cwd(), f)}:${i + 1}`));
  expect(offenders).toEqual([]);
});
