import fs from 'fs';
import path from 'path';
import { expect, test } from 'vitest';
import { describeQuery, webNotifTarget } from '../src/lib/notifications';
import tr from '../src/i18n/tr.json';
import en from '../src/i18n/en.json';

/** Sunucunun gönderdiği bildirim anahtarları (api/src altında push(…, 'notif.x' çağrıları ve onay/ret anahtarları). */
function serverKeys(): string[] {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/'notif\.(\w+)'/g)) keys.add(m[1]);
    }
  };
  walk(path.join(__dirname, '../../api/src'));
  return [...keys];
}

test('sunucunun her bildirim anahtarının sitede iki dilde metni var', () => {
  const keys = serverKeys();
  expect(keys.length).toBeGreaterThan(15);
  for (const k of keys) {
    expect((tr as any).notif?.[k], `tr notif.${k}`).toBeTruthy();
    expect((en as any).notif?.[k], `en notif.${k}`).toBeTruthy();
  }
});

test('bildirim hedefleri: ilan, mesaj, ilanlarım; uygulamaya özel işler bağlantısız', () => {
  expect(webNotifTarget('notif.searchMatch', { listingId: 'abc123' })).toBe('/ilan/abc123');
  expect(webNotifTarget('notif.newMessage', { conversationId: 'c1' })).toBe('/hesabim/mesajlar/c1');
  expect(webNotifTarget('notif.listingRejected', {})).toBe('/hesabim/ilanlar');
  expect(webNotifTarget('notif.newQuote', { jobId: 'j' })).toBeNull();
  expect(webNotifTarget('notif.priceDrop', null)).toBeNull();
});

test('kayıtlı arama özeti', () => {
  const types = { yelkenli: 'Yelkenli' };
  expect(describeQuery({ equipment: [], type: 'yelkenli', location: 'Bodrum', minLength: 10, maxLength: 14, minYear: 2015, maxPrice: 150000, currency: 'EUR' }, 'tr', types, 'Tüm ilanlar'))
    .toBe('Yelkenli · Bodrum · 10–14 m · 2015+ · ≤ €150.000');
  expect(describeQuery({ equipment: [] }, 'tr', types, 'Tüm ilanlar')).toBe('Tüm ilanlar');
  expect(describeQuery({ equipment: [], minYear: 2010, maxYear: 2020 }, 'en', types, 'All')).toBe('2010–2020');
});
