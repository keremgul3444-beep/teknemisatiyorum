import { describe, expect, test } from 'vitest';
import tr from '../src/i18n/tr.json';
import en from '../src/i18n/en.json';
import { localePath, t } from '../src/i18n';

const flat = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? flat(v, `${p}${k}.`) : [`${p}${k}`]));

describe('çeviriler', () => {
  test('iki dil aynı anahtarlara sahip', () => expect(flat(en).sort()).toEqual(flat(tr).sort()));
  test('parametre ve dil yolu', () => {
    expect(t('tr', 'home.title')).toBeTruthy();
    expect(t('en', 'seo.pageTitle', { title: 'X' })).toBe('X | teknemisatıyorum');
    expect(localePath('tr', '/ilanlar')).toBe('/ilanlar');
    expect(localePath('en', '/ilanlar')).toBe('/en/ilanlar');
    expect(localePath('en', '/')).toBe('/en');
    expect(localePath('tr', '/')).toBe('/');
  });
  test('eksik anahtar geliştirmede hata verir', () => expect(() => t('tr', 'yok.boyle.bir.anahtar')).toThrow());
});
