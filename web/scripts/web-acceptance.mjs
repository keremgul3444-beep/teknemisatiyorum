// Web vitrini kabul testi: tasarım belgesi §10'daki kriterleri gerçek sunucuya (API 3000) ve siteye (3001) karşı dener.
// Önkoşul: `npm run dev -- --web --no-mobile` açık; api/.env'de DEV_OTP_ECHO=1, PAYMENTS_MODE=dev.
// Yönetici kodu ekranda/yanıtta çıkmaz: DEV_LOG=<npm run dev çıktısının dosyası> ile çalıştır.
// Kullanım: node web/scripts/web-acceptance.mjs   → docs/web-kabul.md + docs/web-shots/*.jpg
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const WEB = process.env.WEB_URL ?? 'http://localhost:3001';
const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'web-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const RUN = Date.now().toString().slice(-5);
const BRAND = `Webkabul${RUN}`;
const SELLER = `+90534${RUN}03`.slice(0, 13);
const ADMIN = '+905000000000';

function randomTckn() {
  const d = [1 + Math.floor(Math.random() * 9), ...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10))];
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}
const slugPart = (s) => s.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const slugOf = (l) => `${slugPart(`${l.brand} ${l.model}`)}-${l.year}-${l.id}`;

async function api(p, { method = 'GET', body, token, raw, headers = {} } = {}) {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function login(phone) {
  const o = await api('/auth/otp', { method: 'POST', body: { phone } });
  let code = o.body.devCode;
  if (!code) {
    // Ekip numarası: kod yanıtta dönmez, sunucu günlüğünden okunur.
    await new Promise((r) => setTimeout(r, 500));
    const lines = fs.readFileSync(process.env.DEV_LOG ?? '', 'utf8').split(/\r?\n/).filter((l) => l.includes(`${phone} için giriş kodu`));
    code = lines.at(-1)?.match(/giriş kodu: (\d{6})/)?.[1];
  }
  if (!code) throw new Error(`Giriş kodu alınamadı: ${phone}`);
  const v = await api('/auth/verify', { method: 'POST', body: { phone, code, deviceName: 'kabul' } });
  if (v.status !== 200) throw new Error(`Giriş başarısız: ${phone} (${v.status})`);
  return v.body.accessToken;
}
/** Satıcı: kimlik doğrulama → fotoğraflı ilan → onaya gönder; yönetici onaylar. */
async function publishListing(token, adminToken, model) {
  await api('/verification/identity', { method: 'POST', token, body: { tckn: randomTckn(), firstName: 'Web', lastName: 'Kabul', birthYear: 1985 } });
  const l = await api('/listings', { method: 'POST', token, body: { brand: BRAND, model, year: 2018, lengthM: 11.2, type: 'yelkenli', price: 142000, currency: 'EUR', location: 'Bodrum', description: 'Web kabul testi ilanı. Bakımlı, temiz, masrafsız.' } });
  const img = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 30, g: 90, b: 140 } } }).jpeg().toBuffer();
  const form = new FormData();
  form.append('visibility', 'public');
  form.append('file', new Blob([img], { type: 'image/jpeg' }), 'p.jpg');
  const up = await fetch(`${API}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }).then((r) => r.json());
  await api(`/listings/${l.body.id}/photos`, { method: 'POST', token, body: { fileIds: [up.id] } });
  await api(`/listings/${l.body.id}/submit`, { method: 'POST', token });
  const d = await api(`/admin/listings/${l.body.id}/decision`, { method: 'POST', token: adminToken, body: { decision: 'approve' } });
  if (d.status !== 200) throw new Error(`Onay başarısız (${d.status})`);
  return (await api(`/listings/${l.body.id}`)).body;
}
async function waitFor(fn, ms = 90000, step = 3000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > until) return false;
    await new Promise((r) => setTimeout(r, step));
  }
}
const html = async (p) => { const r = await fetch(`${WEB}${p}`, { redirect: 'manual' }); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
const page = await ctx.newPage();
const results = [];
async function criterion(n, title, evidence, fn) {
  try {
    const note = await fn();
    await page.screenshot({ path: path.join(SHOTS, `kriter-${n}.jpg`), type: 'jpeg', quality: 70 });
    results.push({ n, title, ok: 'geçti', evidence, note: note ?? '' });
  } catch (e) {
    await page.screenshot({ path: path.join(SHOTS, `kriter-${n}-hata.jpg`), type: 'jpeg', quality: 70 }).catch(() => {});
    results.push({ n, title, ok: 'kaldı', evidence, note: String(e.message).split('\n')[0] });
  }
  const r = results.at(-1);
  console.log(`${r.ok === 'geçti' ? '✓' : '✗'} ${n}. ${title}${r.note ? ' — ' + r.note : ''}`);
}

const adminToken = await login(ADMIN);
const sellerToken = await login(SELLER);
const sellerCodeAt = Date.now(); // aynı numaraya dakikada tek kod: tarayıcı girişi bundan ≥61 sn sonra
const listing = await publishListing(sellerToken, adminToken, 'Oceanis 40');
const doomed = await publishListing(sellerToken, adminToken, 'Oceanis 31');

await criterion(1, 'Site iki dilde açılır; tüm sayfa türleri gerçek veriyle çalışır',
  'Ana sayfa (TR/EN), arama, hazır arama, ilan detayı, ekspertiz, usta-ol, KVKK sayfaları 200 döner ve başlıkları dolu.', async () => {
    for (const p of ['/', '/en', '/ilanlar', '/satilik/yelkenli', `/ilan/${slugOf(listing)}`, '/ekspertiz', '/usta-ol', '/kvkk', '/en/kvkk']) {
      const r = await html(p);
      if (r.status !== 200) throw new Error(`${p} → ${r.status}`);
      if (!/<title>[^<]{5,}/.test(r.text)) throw new Error(`${p} başlıksız`);
    }
    await page.goto(`${WEB}/`);
    await page.getByRole('button', { name: 'Yalnızca zorunlu' }).click().catch(() => {});
  });

await criterion(2, 'İlan sayfası Google için hazır; site haritası güncel; kalkan ilan 410',
  'İlan başlığı kalıba uyar, paylaşım görseli ve schema.org Product var; site haritası yeni ilanı içerir; kaldırılan ilan 410 döner ve haritada yoktur.', async () => {
    const r = await html(`/ilan/${slugOf(listing)}`);
    if (!r.text.includes(`<title>Satılık ${BRAND} Oceanis 40 (2018) · Bodrum`)) throw new Error('başlık kalıba uymuyor');
    if (!/property="og:image" content="[^"]+\/media\/[^"]+\?w=1600"/.test(r.text)) throw new Error('paylaşım görseli yok');
    if (!r.text.includes('"@type":"Product"')) throw new Error('schema.org Product yok');
    await api(`/listings/${doomed.id}`, { method: 'DELETE', token: sellerToken });
    const gone = await html(`/ilan/${slugOf(doomed)}`);
    if (gone.status !== 410) throw new Error(`kalkan ilan ${gone.status}`);
    const ok = await waitFor(async () => {
      const sm = (await html('/sitemap.xml')).text;
      return sm.includes(slugOf(listing)) && !sm.includes(slugOf(doomed));
    });
    if (!ok) throw new Error('site haritası güncellenmedi');
    await page.goto(`${WEB}/ilan/${slugOf(listing)}`);
  });

await criterion(3, 'Satıcı siteye girer, Vitrin 7 günü deneme ödemesiyle alır; sitede ve uygulamada etiketli',
  'Tarayıcıda /giris → kod → Hesabım/İlanlarım → Öne çıkar → Vitrin · 7 gün → deneme ödemesi → sonuç; ilan sayfasında "Vitrin" etiketi; uygulamanın vitrin şeridi (GET /listings/showcase) ilanı içerir.', async () => {
    await new Promise((r) => setTimeout(r, Math.max(0, 61_000 - (Date.now() - sellerCodeAt))));
    await page.goto(`${WEB}/giris?next=/hesabim/ilanlar`);
    await page.locator('#phone').fill(SELLER.slice(3));
    await page.getByRole('button', { name: 'Kod gönder' }).click();
    await page.locator('#code').waitFor();
    await page.waitForFunction(() => document.querySelector('#code')?.value.length === 6, null, { timeout: 10000 });
    await page.getByRole('button', { name: 'Doğrula' }).click();
    await page.waitForURL(/\/hesabim\/ilanlar/, { timeout: 30000 });
    await page.locator(`a[href$="/hesabim/ilanlar/${listing.id}/one-cikar"]`).click();
    await page.getByText('Vitrin · 7 gün').waitFor();
    await page.locator('.card', { hasText: 'Vitrin · 7 gün' }).getByRole('button', { name: 'Satın al' }).click();
    await page.waitForURL(/\/odeme\/deneme/, { timeout: 30000 });
    await page.getByText('DENEME ÖDEMESİ').first().waitFor();
    await page.screenshot({ path: path.join(SHOTS, 'odeme-deneme.jpg'), type: 'jpeg', quality: 70 });
    await page.getByRole('button', { name: 'Başarılı öde' }).click();
    await page.waitForURL(/\/odeme\/sonuc/, { timeout: 30000 });
    await page.getByRole('heading', { name: 'Öne çıkarma etkin' }).waitFor({ timeout: 30000 });
    const show = await api('/listings/showcase');
    if (!show.body.featured.some((x) => x.id === listing.id)) throw new Error('uygulama vitrin şeridinde yok');
    const badge = await waitFor(async () => (await html(`/ilan/${slugOf(listing)}`)).text.includes('pill featured'));
    if (!badge) throw new Error('ilan sayfasında Vitrin etiketi yok');
    await page.goto(`${WEB}/ilan/${slugOf(listing)}`);
  });

await criterion(4, 'Uygulamadan Acil 7 gün (deneme mağaza ödemesi); sitede Acil etiketi',
  'Uygulamanın kullandığı uç (POST /orders/store, deneme makbuzu) ile Acil · 7 gün alınır; ilan sitede "Acil" etiketiyle görünür.', async () => {
    const r = await api('/orders/store', { method: 'POST', token: sellerToken, body: { listingId: listing.id, platform: 'ios', receipt: `dev:tms.acil_7:${RUN}abcdef` } });
    if (r.status !== 201) throw new Error(`mağaza satın alma ${r.status}`);
    const ok = await waitFor(async () => (await html(`/ilan/${slugOf(listing)}`)).text.includes('pill urgent'));
    if (!ok) throw new Error('Acil etiketi görünmedi');
    await page.goto(`${WEB}/ilan/${slugOf(listing)}`);
  });

await criterion(5, 'Yönetici havale siparişi oluşturur, iade eder, fiyat değiştirir; hepsi kayıtta',
  'Yönetim uçları (uygulamanın Siparişler/Fiyatlar ekranlarının çağırdığı): havale siparişi (açıklamalı), iade, vitrin_7 site fiyatı; işlem kaydında üç kayıt.', async () => {
    const m = await api('/admin/orders/manual', { method: 'POST', token: adminToken, body: { listingId: listing.id, productCode: 'vitrin_30', note: `Dekont TEST ${RUN}` } });
    if (m.status !== 201) throw new Error(`havale ${m.status}`);
    const rf = await api(`/admin/orders/${m.body.orderId}/refund`, { method: 'POST', token: adminToken });
    if (rf.status !== 204) throw new Error(`iade ${rf.status}`);
    const cur = (await api('/products')).body.find((p) => p.code === 'vitrin_7');
    const pr = await api('/admin/products/vitrin_7', { method: 'PUT', token: adminToken, body: { priceWebKurus: cur.priceWebKurus, priceAppKurus: cur.priceAppKurus } });
    if (pr.status !== 200) throw new Error(`fiyat ${pr.status}`);
    const audit = (await api('/admin/audit', { token: adminToken })).body;
    for (const a of ['audit.orderManual', 'audit.orderRefunded', 'audit.productPriceChanged']) if (!audit.some((x) => x.action === a)) throw new Error(`kayıt yok: ${a}`);
  });

await criterion(6, 'Sahte ödeme bildirimi ve tekrar kullanılan makbuz reddedilir',
  'İmzasız POST /payments/web/callback → 400; aynı deneme makbuzu ikinci kez → 409 RECEIPT_USED.', async () => {
    const fake = await api('/payments/web/callback', { method: 'POST', raw: JSON.stringify({ providerRef: 'dev_x', orderId: 'x', result: 'success', amountKurus: 1 }), headers: { 'Content-Type': 'application/json' } });
    if (fake.status !== 400) throw new Error(`sahte bildirim ${fake.status}`);
    const again = await api('/orders/store', { method: 'POST', token: sellerToken, body: { listingId: listing.id, platform: 'ios', receipt: `dev:tms.acil_7:${RUN}abcdef` } });
    if (again.status !== 409 || again.body.code !== 'RECEIPT_USED') throw new Error(`tekrar makbuz ${again.status}`);
  });

await page.goto(`${WEB}/`);
await page.screenshot({ path: path.join(SHOTS, 'ana-sayfa.jpg'), type: 'jpeg', quality: 70, fullPage: true });
await browser.close();

const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
const md = [
  '# Web vitrini kabul testi', '',
  `Çalıştırma: ${date} · Betik: \`web/scripts/web-acceptance.mjs\` · Gerçek sunucu · Chrome 390×844`, '',
  ...results.flatMap((r) => [
    `## ${r.ok === 'geçti' ? '✓' : '✗'} ${r.n}. ${r.title} — ${r.ok}`, '', r.evidence, '',
    ...(r.note ? [`**Not:** ${r.note}`, ''] : []),
    `![kriter ${r.n}](web-shots/kriter-${r.n}${r.ok === 'kaldı' ? '-hata' : ''}.jpg)`, '',
  ]),
].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs', 'web-kabul.md'), md);
process.exit(results.every((r) => r.ok !== 'kaldı') ? 0 : 1);
