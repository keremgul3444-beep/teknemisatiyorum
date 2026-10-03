// Tasarım belgesi §6'daki 10 demo akışını tek tarayıcı oturumunda uçtan uca tıklar.
// Kullanım: önce `npx expo start --web --port 8081`, sonra `node scripts/demo-flows.mjs`.
// Sonuç: docs/demo-akislari.md ve docs/demo-shots/*.jpg
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'demo-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, headless: true } : { channel: 'chrome', headless: true });
// Akışlar Türkçe metinle yazıldı; uygulama dili tarayıcı dilinden gelir.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Yığındaki ve sekmelerdeki diğer ekranlar DOM'da (saydam) durur; yalnızca en üstte gerçekten
// dokunulabilen öğe hedeflenir.
async function top(l, timeout = 5000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const n = await l.count();
    for (let i = 0; i < n; i++) {
      const el = l.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      await el.scrollIntoViewIfNeeded({ timeout: 150 }).catch(() => {});
      const hit = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
        const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
        // pointer-events:none olan katmanlar (ör. bildirim balonu) dokunulamaz ama görünürdür.
        if (getComputedStyle(node).pointerEvents === 'none') return true;
        const at = document.elementFromPoint(x, y);
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
const click = async (s, ex = false) => { await (ex ? exact(s) : text(s)).click(); await page.waitForTimeout(350); };
const see = async (s, timeout = 5000) => { await text(s).waitFor({ timeout }); };
const fillPh = async (ph, value) => { await vis(page.getByPlaceholder(ph, { exact: false })).fill(value); await page.waitForTimeout(150); };
// Zorunlu alanların erişilebilir adı "Etiket, zorunlu" biçimindedir.
const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byLabel = (l) => vis(page.getByLabel(new RegExp(`^${reEsc(l)}(, zorunlu)?$`)));
const tab = async (name) => {
  for (let i = 0; i < 6; i++) {
    const t = await top(page.getByRole('tab', { name, exact: true }), 1500).catch(() => null);
    if (t) { await t.click(); await page.waitForTimeout(400); return; }
    const back = await top(page.locator('[aria-label="Geri"], [aria-label="Back"]'), 2500).catch(() => null);
    if (!back) break;
    await back.click();
    await page.waitForTimeout(350);
  }
  throw new Error(`Sekme bulunamadı: ${name}`);
};
// Asistan kutusunun düğmesi yalnızca simge; erişilebilir adıyla (assistant.search) tıklanır.
const SEARCH_LABEL = 'Ara';
const submitSearch = async () => { await (await top(page.getByRole('button', { name: SEARCH_LABEL, exact: true }))).click(); await page.waitForTimeout(350); };
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 70 });

const results = [];
async function flow(n, title, steps, fn) {
  const before = errors.length;
  try {
    await fn();
    await shot(`akis-${String(n).padStart(2, '0')}`);
    const newErr = errors.slice(before);
    results.push({ n, title, steps, ok: newErr.length === 0, note: newErr.join(' | ') });
  } catch (e) {
    await shot(`akis-${String(n).padStart(2, '0')}-hata`).catch(() => {});
    results.push({ n, title, steps, ok: false, note: String(e.message).split('\n')[0] });
  }
  console.log(`${results.at(-1).ok ? '✓' : '✗'} ${n}. ${title}${results.at(-1).ok ? '' : ' — ' + results.at(-1).note}`);
}

// Açılış ve giriş (akışların ön koşulu)
await page.goto(`${BASE}/onboarding`);
await see('Başla', 30000);
await click('Başla');

await flow(11, 'Misafir kimlik kapısını atlayamaz (inceleme bulgusu)', 'Giriş yapmamış kullanıcı Değerleme → "Ücretsiz ilan ver" ile sihirbaza gitmeye çalışır; önce giriş ekranına yönlenir.', async () => {
  await click('Teknem kaç eder?');
  await click('Hesapla', true);
  await click('Ücretsiz ilan ver');
  await see('Giriş yap veya kayıt ol');
});
await tab('Profil');
await click('Giriş yap / Kayıt ol');
await fillPh('5xx', '5321234512');
await click('Kod gönder');
await vis(page.locator('input[inputmode="numeric"]')).fill('123456');
await click('Doğrula', true);
// Girişten sonra girişi başlatan sayfaya (Profil) dönülür.
await see('Çıkış yap');
await tab('Keşfet');
await see('Teknen için her şey');

await flow(1, 'Asistanla arama → ilan → mesaj', 'Keşfet\'te asistana sorgu yazılır, 3 tam eşleşme görülür, ilan açılır, satıcıya mesaj atılır ve otomatik yanıt gelir.', async () => {
  await fillPh('Ne aradığını yaz:', '12 metreye kadar jeneratörlü brandalı 2015 sonrası');
  await submitSearch();
  await see('Tam eşleşen (3)');
  await click('Galeon 360 Fly · 2020');
  await see('Özellikler');
  await see('Tekne Karnesi');
  await click('Mesaj gönder');
  await fillPh('Mesaj yaz', 'Merhaba, tekneyi görmek isterim');
  await page.keyboard.press('Enter');
  await see('Merhaba, tekneyi görmek isterim');
  await see('en kısa sürede', 4000);
});

await flow(2, 'Sonuçsuz aramayı talebe çevirme', 'Eşleşmesi olmayan bir sorgu aranır, "Bu aramayı kaydet" ile kaydedilir ve kayıtlı aramalarda görünür.', async () => {
  await tab('Keşfet');
  await fillPh('Ne aradığını yaz:', '40 metre katamaran 2024 sonrası');
  await submitSearch();
  await see('Birebir eşleşen ilan yok');
  await click('Bu aramayı kaydet');
  await see('Arama kaydedildi');
  await tab('Profil');
  await click('Kayıtlı aramalar');
  await see('40 metre katamaran 2024 sonrası');
});

await flow(3, 'İlan verme (kimlik doğrulama dahil)', 'Ekle → İlan ver; kimlik doğrulanır, 5 adımlı sihirbaz doldurulur, önizleme sonrası yayınlanır, "Onay bekliyor" olarak görünür.', async () => {
  await tab('Ekle');
  await click('İlan ver', true);
  await see('Kimliğini doğrula');
  await fillPh('•••', '12345678901');
  await byLabel('Ad').fill('Deniz');
  await byLabel('Soyad').fill('Yılmaz');
  await byLabel('Doğum yılı').fill('1988');
  await click('Doğrula', true);
  await see('Kimliğin doğrulandı', 4000);
  await click('Devam et');
  await tab('Ekle');
  await click('İlan ver', true);
  await see('En az 1 fotoğraf');
  await click('Ekle', true);
  await click('İleri', true);
  await fillPh('Beneteau', 'Bavaria');
  await fillPh('Oceanis 40', 'Cruiser 41');
  await byLabel('Model yılı').fill('2016');
  await byLabel('Boy (m)').fill('12,4');
  await click('Yelkenli', true);
  await click('İleri', true);
  await click('Jeneratör', true);
  await click('İleri', true);
  await byLabel('Fiyat').fill('149000');
  await click('Bodrum', true);
  await click('İleri', true);
  await click('Yükle', true);
  await click('Önizleme', true);
  await see('Bavaria Cruiser 41');
  await click('Yayınla', true);
  await see('İlanın onaya gönderildi');
  await click('İlanlarıma git');
  await see('Bavaria Cruiser 41');
});

await flow(4, 'Usta işi → güvenli ödeme → karne', 'Hizmetler\'de dert yazılır, talep açılır, 3 teklif karşılaştırılıp biri kabul edilir, güvenli ödeme yapılır, iş onaylanır, değerlendirilir ve karneye düşer.', async () => {
  await tab('Hizmetler');
  await fillPh('motorum su', 'motorum su alıyor');
  await (await top(page.getByRole('button', { name: 'Talep oluştur', exact: true }))).click(); await page.waitForTimeout(350);
  await see('Hizmet talebi');
  await fillPh('Sorunu', 'Sintineye su geliyor, motor bölmesi ıslak.');
  await click('Talebi gönder');
  await see('Gelen teklifler (3)');
  await click('Kabul et', true);
  await click('Güvenli öde', true);
  await fillPh('4242', '4242424242424242');
  await fillPh('12/28', '1228');
  await fillPh('123', '123');
  await vis(page.getByText(/ öde$/)).click();
  await see('İşi onayla', 6000);
  await click('İşi onayla (tamamlandı)');
  await click('Değerlendir', true);
  await see('Karneye işlendi');
  await click('Karneyi gör');
  await see('motorum su alıyor');
});

await flow(5, 'Haftalık kaptan kiralama', 'Kaptan ekranında haftalık seçilir, kaptan profili (belgeler) incelenir, rezervasyon yapılıp ödenir.', async () => {
  await tab('Hizmetler');
  await click('Günlük ya da haftalık belgeli kaptan');
  await click('Haftalık', true);
  await click('Kaptan Ece Güneş');
  await page.waitForTimeout(400);
  await see('Kaptan Yeterlik');
  await see('Haftalık ücret uygulandı');
  await click('Rezerve et ve öde');
  await fillPh('4242', '4242424242424242');
  await fillPh('12/28', '1228');
  await fillPh('123', '123');
  await vis(page.getByText(/ öde$/)).click();
  await see('Güvencede', 6000);
});

await flow(6, 'İlandan ekspertiz randevusu', 'İlan detayında "Ekspertiz iste" ile paket ve tarih seçilir, randevu alınır, örnek rapor açılır.', async () => {
  await tab('Keşfet');
  await vis(page.getByText(/ · 20\d\d$/)).click();
  await click('Ekspertiz iste');
  await see('Paket seç');
  await vis(page.getByText(/(Pzt|Sal|Çar|Per|Cum|Cmt|Paz)/)).click();
  await click('Randevu al', true);
  await see('Randevun oluşturuldu');
  await click('Örnek raporu gör');
  await see('Genel skor');
});

await flow(7, 'Broker başvurusu', 'Hizmetler → Broker; tekne seçilip beklenen fiyat girilir, başvurulur, süreç takip ekranı görünür.', async () => {
  await tab('Hizmetler');
  await click('Tekneni senin yerine satalım');
  await see('Uçtan uca broker hizmeti');
  await byLabel('Beklenen fiyat (€)').fill('95000');
  await click('Başvur', true);
  await see('Değerleme');
  await see('Atanan broker');
});

await flow(8, 'Değerleme', 'Keşfet → "Teknem kaç eder?"; tip, yıl, boy ile hesaplanır, fiyat aralığı ve benzer ilanlar görünür.', async () => {
  await tab('Keşfet');
  await click('Teknem kaç eder?');
  await click('Hesapla', true);
  await see('benzer ilana dayanır');
  await see('Benzer ilanlar');
});

await flow(9, 'Roller ve yönetim onayı', 'Demo rol değiştirici ile usta, kurumsal ve yönetici panelleri açılır; yönetim panelinde akış 3\'teki ilan onaylanır ve Keşfet\'te yayında görünür.', async () => {
  await tab('Profil');
  await click('Ayarlar', true);
  await click('Usta', true);
  await tab('Profil');
  await click('Hizmet paneli');
  await see('Gelen talepler');
  await tab('Profil');
  await click('Ayarlar', true);
  await click('Kurumsal', true);
  await tab('Profil');
  await click('Firma paneli');
  await see('Mavi Koy Yatçılık');
  await tab('Profil');
  await click('Ayarlar', true);
  await click('Yönetici', true);
  await tab('Profil');
  await click('Yönetim paneli');
  await see('Aktif ilan');
  await click('İlan onayları');
  await see('Bavaria Cruiser 41');
  await exact('Onayla').click();
  await see('Onaylandı');
  await vis(page.locator('[aria-label="Geri"], [aria-label="Back"]')).click();
  await page.waitForTimeout(400);
  await tab('Keşfet');
  await fillPh('Ne aradığını yaz:', 'Bodrum yelkenli');
  await submitSearch();
  await see('Bavaria Cruiser 41');
});

await flow(10, 'Dil: İngilizce', 'Ayarlar\'dan English seçilir; sekmeler ve ekranlar İngilizce görünür.', async () => {
  await tab('Profil');
  await click('Ayarlar', true);
  await click('English', true);
  await see('Settings');
  await tab('Explore');
  await see('Everything for your boat');
  await tab('Services');
  await see('Verified professionals');
  await tab('Messages');
  await see('Messages');
});

await browser.close();

const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
const md = [
  '# Demo akışları — doğrulama sonucu', '',
  `Çalıştırma: ${date} · Betik: \`mobile/scripts/demo-flows.mjs\` · Tarayıcı: Chrome (390×844)`, '',
  `**Sonuç: ${results.filter((r) => r.ok).length}/${results.length} akış geçti.**`, '',
  ...results.flatMap((r) => [
    `## ${r.ok ? '✓' : '✗'} ${r.n}. ${r.title}`, '', r.steps, '',
    ...(r.ok ? [] : [`**Hata:** ${r.note}`, '']),
    `![akış ${r.n}](demo-shots/akis-${String(r.n).padStart(2, '0')}${r.ok ? '' : '-hata'}.jpg)`, '',
  ]),
].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs', 'demo-akislari.md'), md);
process.exit(results.every((r) => r.ok) ? 0 : 1);
