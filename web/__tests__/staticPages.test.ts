import fs from 'fs';
import path from 'path';
import { expect, test } from 'vitest';
import { STATIC_PAGES } from '../src/lib/pages';
import tr from '../src/i18n/tr.json';
import en from '../src/i18n/en.json';

const LEGAL = ['/kvkk', '/gizlilik', '/kullanim-kosullari', '/cerezler'];

test('her sabit sayfanın dosyası, iki dilde başlığı ve açıklaması var; yasal sayfalar taslak şeridi taşır', () => {
  for (const p of STATIC_PAGES) {
    const file = path.join(__dirname, '../src/app/[locale]', p.path, 'page.tsx');
    expect(fs.existsSync(file), p.path).toBe(true);
    for (const d of [tr, en] as Record<string, any>[]) {
      expect(d.pages[p.key]?.title, `${p.key}.title`).toBeTruthy();
      expect(d.pages[p.key]?.description, `${p.key}.description`).toBeTruthy();
    }
    if (LEGAL.includes(p.path)) expect(fs.readFileSync(file, 'utf8'), p.path).toContain('<DraftBanner');
  }
});
