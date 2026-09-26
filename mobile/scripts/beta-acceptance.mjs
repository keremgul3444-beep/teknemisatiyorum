// Kapalı beta kabul testi: tasarım belgesi §11'deki 6 kriteri gerçek sunucuya karşı tarayıcıdan dener.
// Önkoşul: `npm run dev` açık (API_PROXY ile), api/.env'de DEV_OTP_ECHO=1.
// Yönetici kodu ekranda çıkmaz: DEV_LOG=<npm run dev çıktısının dosyası> ile çalıştır.
// Kullanım: node mobile/scripts/beta-acceptance.mjs   → docs/beta-kabul.md + docs/beta-shots/*.jpg
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'beta-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const RUN = Date.now().toString().slice(-5);
const BRAND = `Kabul${RUN}`;
/** Her çalıştırmada yeni, algoritmik olarak geçerli T.C. numarası (numara tek hesaba bağlanır). */
function randomTckn() {
  const d = [1 + Math.floor(Math.random() * 9), ...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10))];
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}
const PHONES = { seller: `532${RUN}01`.slice(0, 10), buyer: `533${RUN}02`.slice(0, 10), admin: '5000000000' };

const photo = path.join(os.tmpdir(), `kabul-${RUN}.jpg`);
await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 30, g: 90, b: 140 } } }).jpeg().toFile(photo);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function session() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}

// ——— En üstteki ekranda görünür öğeyi hedefleyen yardımcılar (demo-flows.mjs ile aynı yaklaşım) ———
function helpers(page) {
  async function top(l, timeout = 8000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const n = await l.count();
      for (let i = 0; i < n; i++) {
        const el = l.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        await el.scrollIntoViewIfNeeded({ timeout: 150 }).catch(() => {});
        const hit = await el.evaluate((node) => {
          const r = node.getBoundingClientRect();
          if (!r.width || !r.height) return false;
          if (getComputedStyle(node).pointerEvents === 'none') return true;
          const at = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
          return !!at && (node === at || node.contains(at) || at.contains(node));
        }).catch(() => false);
        if (hit) return el;
      }
      await page.waitForTimeout(200);
    }
    throw new Error(`Görünür öğe yok: ${l}`);
  }
  const vis = (l) => ({ click: async () => (await top(l)).click(), fill: async (v) => (await top(l)).fill(v), waitFor: async (o) => top(l, o?.timeout) });
  const text = (s) => vis(page.getByText(s, { exact: false }));
  const exact = (s) => vis(page.getByText(s, { exact: true }));
  const click = async (s, ex = false) => { await (ex ? exact(s) : text(s)).click(); await page.waitForTimeout(400); };
  const see = async (s, timeout = 10000) => { await text(s).waitFor({ timeout }); };
  const fillPh = async (ph, v) => { await vis(page.getByPlaceholder(ph, { exact: false })).fill(v); await page.waitForTimeout(150); };
  const byLabel = (l) => vis(page.getByLabel(l, { exact: true }));
  const tab = async (name) => {
    for (let i = 0; i < 8; i++) {
      const t = await top(page.getByRole('tab', { name, exact: true }), 1500).catch(() => null);
      if (t) { await t.click(); await page.waitForTimeout(500); return; }
      const back = await top(page.locator('[aria-label="Geri"], [aria-label="Back"]'), 2500).catch(() => null);
      if (!back) break;
      await back.click();
      await page.waitForTimeout(400);
    }
    throw new Error(`Sekme bulunamadı: ${name}`);
  };
  async function login(phone) {
    await tab('Profil');
    await click('Giriş yap / Kayıt ol');
    await fillPh('5xx', phone);
    await click('Kod gönder');
    // Aynı numaraya dakikada tek kod: sunucu "bir dakika bekle" derse bekleyip bir kez daha istenir.
    if (!(await text('Doğrulama kodu').waitFor({ timeout: 5000 }).then(() => true, () => false))) {
      await page.waitForTimeout(61_000);
      await click('Kod gönder');
      await see('Doğrulama kodu');
    }
    await page.waitForTimeout(500);
    // Yönetici hesaplarına kod ekranda gösterilmez (güvenlik); kapalı betada sunucu günlüğünden okunur.
    if (phone === PHONES.admin) {
      if (!process.env.DEV_LOG) throw new Error('Yönetici kodu için DEV_LOG=<sunucu günlüğü> gerekli');
      const lines = fs.readFileSync(process.env.DEV_LOG, 'utf8').split(/\r?\n/).filter((l) => l.includes(`+90${phone} için giriş kodu`));
      const code = lines.at(-1)?.match(/giriş kodu: (\d{6})/)?.[1];
      if (!code) throw new Error('Yönetici kodu günlükte yok');
      await page.keyboard.type(code);
      await page.waitForTimeout(300);
    }
    await click('Doğrula', true);
    await see('Çıkış yap');
  }
  /** Sayfayı yeniden yüklemeden uygulama içinde bir adrese gider (web'de oturum bellekte tutulur). */
  async function nav(url) {
    await page.evaluate((u) => { window.history.pushState({}, '', u); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, url);
    await page.waitForTimeout(1200);
  }
  return { click, see, fillPh, byLabel, tab, login, text, nav };
}

async function open(page) {
  await page.goto(`${BASE}/onboarding`);
  await page.getByText('Başla', { exact: true }).first().waitFor({ timeout: 60000 });
  await page.getByText('Başla', { exact: true }).first().click();
  await page.waitForTimeout(1500);
}
const api = async (p, init) => {
  const r = await fetch(`${BASE}/api${p}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const results = [];
async function criterion(n, title, evidence, fn, page) {
  try {
    const note = await fn();
    await page?.screenshot({ path: path.join(SHOTS, `kriter-${n}.jpg`), type: 'jpeg', quality: 70 });
    results.push({ n, title, ok: note?.partial ? 'kısmi' : 'geçti', evidence, note: note?.text ?? '' });
  } catch (e) {
    await page?.screenshot({ path: path.join(SHOTS, `kriter-${n}-hata.jpg`), type: 'jpeg', quality: 70 }).catch(() => {});
    results.push({ n, title, ok: 'kaldı', evidence, note: String(e.message).split('\n')[0] });
  }
  const r = results.at(-1);
  console.log(`${r.ok === 'geçti' ? '✓' : r.ok === 'kısmi' ? '◐' : '✗'} ${n}. ${title}${r.note ? ' — ' + r.note : ''}`);
}

const seller = await session();
const S = helpers(seller.page);
const buyer = await session();
const B = helpers(buyer.page);
const admin = await session();
const A = helpers(admin.page);
let listingId = null;

await criterion(1, 'Telefonla giriş (kod SMS yerine uygulamaya gelir)', 'Satıcı numarasıyla kod istenir, kod ekranda dolar, Doğrula ile oturum açılır.', async () => {
  await open(seller.page);
  await S.login(PHONES.seller);
}, seller.page);

await criterion(2, 'Kimlik → fotoğraflı ilan → yönetici onayı → Keşfet', 'Satıcı T.C. kimliğini doğrular, gerçek fotoğraf yükleyerek ilan verir; yönetici onaylar; ilan herkese açık aramada çıkar.', async () => {
  const { page } = seller;
  await S.tab('Ekle');
  await S.click('İlan ver', true);
  await S.see('Kimliğini doğrula');
  await S.fillPh('•••', randomTckn());
  await S.byLabel('Ad').fill('Deniz');
  await S.byLabel('Soyad').fill('Kabul');
  await S.byLabel('Doğum yılı').fill('1988');
  await S.click('Doğrula', true);
  await S.see('Kimliğin doğrulandı');
  await S.click('Devam et');
  await S.tab('Ekle');
  await S.click('İlan ver', true);
  await S.see('En az 1 fotoğraf');
  const chooser = page.waitForEvent('filechooser', { timeout: 10000 });
  await S.click('Ekle', true);
  await (await chooser).setFiles(photo);
  await page.waitForTimeout(800);
  await S.click('İleri', true);
  await S.fillPh('Beneteau', BRAND);
  await S.fillPh('Oceanis 40', 'Oceanis 38');
  await S.byLabel('Model yılı').fill('2017');
  await S.byLabel('Boy (m)').fill('11,5');
  await S.click('Yelkenli', true);
  await S.click('İleri', true);
  await S.click('İleri', true);
  await S.byLabel('Fiyat').fill('150000');
  await S.click('Bodrum', true);
  await S.click('İleri', true);
  await S.click('Önizleme', true);
  await S.click('Yayınla', true);
  await S.see('İlanın onaya gönderildi', 30000);

  await open(admin.page);
  await A.login(PHONES.admin);
  await A.click('Yönetim paneli');
  await A.click('İlan onayları');
  await A.see(BRAND);
  // Gerçek modda onaylanan ilan bekleyenler kuyruğundan kalkar; yayına girdiği sunucudan doğrulanır.
  const q = encodeURIComponent(JSON.stringify({ equipment: [], location: 'Bodrum', type: 'yelkenli' }));
  let hit;
  for (let attempt = 0; attempt < 3 && !hit; attempt++) {
    // Kuyruktaki satırın kendi Onayla düğmesi (başlığı içeren kartın içinde).
    const card = admin.page.locator('div').filter({ hasText: BRAND }).filter({ has: admin.page.getByText('Onayla', { exact: true }) }).last();
    await card.getByText('Onayla', { exact: true }).click().catch(() => {});
    for (let i = 0; i < 12 && !hit; i++) {
      await admin.page.waitForTimeout(500);
      hit = (await api(`/listings?q=${q}`)).body.items?.find((l) => l.brand === BRAND);
    }
  }
  if (!hit) throw new Error('Onaylanan ilan herkese açık aramada yok');
  if (!hit.photos?.length) throw new Error('İlanın fotoğrafı yok');
  listingId = hit.id;
}, admin.page);

await criterion(3, 'Akıllı Asistan (Claude ve yedeği)', 'Asistana metin yazılır, sonuçlar veritabanından gelir. Claude anahtarı yoksa kural tabanlı yedek devrededir.', async () => {
  const r = await api('/assistant/search', { method: 'POST', body: JSON.stringify({ text: `Bodrum yelkenli 2015 sonrası` }) });
  if (r.status !== 200) throw new Error(`asistan ${r.status}`);
  if (!r.body.exact.some((l) => l.brand === BRAND)) throw new Error('Yeni ilan asistan sonucunda yok');
  await S.tab('Keşfet');
  await S.fillPh('Ne aradığını yaz:', 'Bodrum yelkenli 2015 sonrası');
  await S.click('Ara', true);
  await S.see('Tam eşleşen');
  return r.body.source === 'llm'
    ? { text: 'Claude ile yanıt verdi.' }
    : { partial: true, text: 'Claude API anahtarı tanımlı değil; kural tabanlı yedek devrede ve doğru sonuç verdi. Claude ile yanıt, anahtar eklenince denenecek.' };
}, seller.page);

await criterion(4, 'İki hesap mesajlaşır; yeniden açınca veriler yerinde', 'Alıcı ilandan satıcıya mesaj atar; satıcı yeniden yükleyip girince mesajı görür.', async () => {
  await open(buyer.page);
  await B.login(PHONES.buyer);
  await B.nav(`/ilan/${listingId}`);
  await B.see(BRAND, 20000);
  await B.click('Mesaj gönder');
  await B.fillPh('Mesaj yaz', 'Merhaba, kabul testi mesajı');
  await buyer.page.keyboard.press('Enter');
  await B.see('Merhaba, kabul testi mesajı');
  await seller.page.reload();
  await open(seller.page);
  await S.login(PHONES.seller);
  await S.tab('Mesajlar');
  await S.see('Merhaba, kabul testi mesajı', 15000);
}, seller.page);

await criterion(5, 'Karne, favori, kayıtlı arama, ekspertiz ve broker kalıcı', 'Alıcı tekne ekler, ilanı favoriler, arama kaydeder, ekspertiz randevusu ve broker başvurusu yapar; sayfa yenilenip tekrar girince hepsi yerinde.', async () => {
  const { page } = buyer;
  await B.tab('Ekle');
  await B.click('Tekne ekle', true);
  await B.byLabel('Tekne adı').fill(`Karne${RUN}`);
  await B.byLabel('Marka').fill('Jeanneau');
  await B.byLabel('Model').fill('SO 349');
  await B.byLabel('Model yılı').fill('2019');
  await B.byLabel('Boy (m)').fill('10,3');
  await B.click('Kaydet ve karneyi başlat');
  await B.see('Tekne eklendi', 15000);
  await B.nav(`/ilan/${listingId}`);
  await B.see(BRAND, 20000);
  await page.getByLabel('Favoriler', { exact: true }).first().click();
  await page.waitForTimeout(800);
  await B.nav(`/aramalar`);
  await B.fillPh('Örn.', `Kabul arama ${RUN}`);
  await B.click('Talebi kaydet');
  await B.see(`Kabul arama ${RUN}`, 15000);
  // Ekspertiz ve broker (kimlik seviyesi 2 gerektirir): önce kimlik
  await B.nav(`/verify/identity`);
  await B.fillPh('•••', '10000000146');
  await B.byLabel('Ad').fill('Alıcı');
  await B.byLabel('Soyad').fill('Kabul');
  await B.byLabel('Doğum yılı').fill('1990');
  await B.click('Doğrula', true);
  await B.see('Kimliğin doğrulandı');
  await B.nav(`/ekspertiz?ilan=${listingId}`);
  await B.see('Paket seç', 20000);
  await page.getByText(/(Pzt|Sal|Çar|Per|Cum|Cmt|Paz)/).last().click();
  await B.click('Randevu al', true);
  await B.see('Randevun oluşturuldu', 15000);
  await B.nav(`/broker`);
  await B.byLabel('Beklenen fiyat (€)').fill('90000');
  await B.click('Başvur', true);
  await B.see('Atanan broker', 15000);

  // Yeniden aç: web'de oturum bellekte tutulur, yenilemede tekrar giriş gerekir; veriler sunucudadır.
  await page.goto(`${BASE}/onboarding`);
  await open(page);
  await B.login(PHONES.buyer);
  await B.click('Teknelerim');
  await B.see(`Karne${RUN}`, 15000);
  await B.tab('Profil');
  await B.click('Favoriler', true);
  await B.see(BRAND, 15000);
  await B.tab('Profil');
  await B.click('Kayıtlı aramalar', true);
  await B.see(`Kabul arama ${RUN}`, 15000);
  await B.tab('Profil');
  await B.click('İşlerim', true);
  await B.click('Ekspertiz randevuları');
  await B.see('Kapsamlı', 15000);
  await B.nav(`/broker`);
  await B.see('Broker dosyalarım', 15000);
}, buyer.page);

await browser.close();

// Kriter 6 (testler + inceleme) ayrıca; bu betik 1–5'i kaydeder.
const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
const md = [
  '# Kapalı beta kabul testi', '',
  `Çalıştırma: ${date} · Betik: \`mobile/scripts/beta-acceptance.mjs\` · Gerçek sunucu (npm run dev) · Chrome 390×844`, '',
  ...results.flatMap((r) => [
    `## ${r.ok === 'geçti' ? '✓' : r.ok === 'kısmi' ? '◐' : '✗'} ${r.n}. ${r.title} — ${r.ok}`, '', r.evidence, '',
    ...(r.note ? [`**Not:** ${r.note}`, ''] : []),
    `![kriter ${r.n}](beta-shots/kriter-${r.n}${r.ok === 'kaldı' ? '-hata' : ''}.jpg)`, '',
  ]),
].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs', 'beta-kabul.md'), md);
process.exit(results.every((r) => r.ok !== 'kaldı') ? 0 : 1);
