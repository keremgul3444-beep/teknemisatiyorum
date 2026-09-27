# Web Vitrini ve Öne Çıkarma — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google'da bulunan bir Next.js vitrin sitesi kurmak ve ilan sahiplerine Vitrin / Acil / Üste taşı ürünlerini hem sitede (sanal POS) hem uygulamada (mağaza ödemesi) — bu turda deneme modunda — satmak.

**Architecture:** Monorepo'ya `web/` (Next.js App Router) eklenir; kendi veritabanı yoktur, tüm veriyi mevcut NestJS API'den alır. API'ye ürün/sipariş/ödeme modülü, öne çıkarma alanları, vitrin/site haritası uçları ve görsel boyutları eklenir. Ödeme sağlayıcıları SMS gibi adaptördür (`dev` bu tur, `live` Aşama 2). Sitede giriş BFF desenidir: anahtarlar HttpOnly çerezde, tarayıcı yalnızca siteyle konuşur.

**Tech Stack:** Next.js 16 (App Router, React 19.2.3), TypeScript, Vitest; NestJS 11 + Prisma 6 + PostgreSQL (mevcut); Expo SDK 57 (mevcut); Playwright-core (mevcut); Lighthouse (npx).

**Spec:** `docs/superpowers/specs/2026-09-27-web-vitrin-design.md`

## Global Constraints

- TR öneksiz, EN `/en/...`; sitede ve uygulamada koda gömülü Türkçe metin yok, sunucu hata/bildirim anahtarlarının hepsi iki dilde çevrili (mevcut `serverKeys.test.ts` deseni).
- Tasarım dili tek kaynak: renk/yazı/boşluk `shared/src/design.ts`'de; mobil `@/theme` ve web CSS değişkenleri buradan.
- Ürünler: `vitrin_7` (vitrin, 7), `vitrin_30` (vitrin, 30), `acil_7` (acil, 7), `acil_30` (acil, 30), `ust_tasi` (bump, tek sefer). Fiyatlar kuruş (tam sayı), site ve uygulama fiyatı ayrı; seed'de 100 kuruş + `isTrialPrice=true`.
- Süreli ürün: `bitiş = max(şimdi, mevcut bitiş) + gün`; üste taşı: `bumpedAt = şimdi`; "en yeni" anahtarı `max(publishedAt, bumpedAt)`. Etki yalnızca `status=published` ilanlarda görünür; süre sorgu zamanında denetlenir.
- Satın alma: ilan yayında ve alıcı sahibi. Elle etkinleştirme yalnızca `admin`, kendi ilanına değil, açıklama zorunlu. İade yalnızca `admin`, süre gün kadar geri çekilir (şimdiden geriye değil).
- Ürün yalnızca sipariş `pending → paid` koşullu geçişinde ve aynı veritabanı işleminde etkinleşir; aynı sağlayıcı referansı/makbuz ikinci kez etkinleştirmez. Geçerli ödeme onayı her zaman etkinleştirir; 24 saatten eski `pending` yalnızca görünümde `cancelled`.
- `PAYMENTS_MODE=dev|live` (varsayılan `dev`); `NODE_ENV=production` iken `dev` başlamayı reddeder; `live` bu turda "sağlayıcı bağlanmadı" hatasıyla başlamayı reddeder.
- Ödeme bildirimi imzası: HMAC-SHA256 (hex), anahtar `PAYMENT_WEBHOOK_SECRET` (≥32 karakter), başlık `X-Signature`, gövde tutarı siparişle eşleşmeli.
- Web oturum çerezleri: `tms_at` (erişim, 15 dk), `tms_rt` (yenileme, 30 gün); `HttpOnly; SameSite=Lax; Path=/`; canlıda `Secure`. Durum değiştiren site isteklerinde `Origin` denetimi.
- Web portu 3001; API 3000; Metro 8081. `npm run dev -- --web` siteyi de açar, `--no-mobile` Metro'yu açmaz.
- Google'a kapalı: `/giris`, `/hesabim/**`, `/odeme/**`, `/asistan`; hazır arama sayfası <3 ilan ise `noindex`. Kalkan ilan 410, yanlış slug 301.
- Lighthouse mobil hedef: ana sayfa ve ilan detayı Performans, SEO, Erişilebilirlik ≥ 90.
- Commit mesajları Türkçe, sonunda:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ve `Claude-Session: https://claude.ai/code/session_01NRgcd6Ltmq7YckqLyrViE5`.
- Gizli değer asla depoya girmez (`api/.env`, `web/.env.local` git dışı).

## Review Focus

1. **Aynı ödeme bildirimi eşzamanlı iki kez gelir** → ürün bir kez açılır, süre bir kez eklenir (Task 7 testi: `Promise.all` ile iki bildirim).
2. **Satılmış/kaldırılmış ilan için sipariş ya da vitrinde görünme** → sipariş 409 `LISTING_NOT_PUBLISHED`, vitrin/arama üstü listelerinde yok (Task 5 ve Task 7 testleri).
3. **Erişim anahtarı süresi dolmuş ziyaretçi `/hesabim`'a gelir** → sessizce yenilenir, sayfa açılır; yenileme de geçersizse `/giris?next=` (Task 16 testi).
4. **Başka bir sitenin sayfasından `/api/auth/*` ya da sipariş POST'u** → 403 (Origin denetimi, Task 16 testi).
5. **Ödeme sayfasında başkasının sipariş kimliği** → 404, tutar/ilan sızmaz (Task 7 ve Task 16 testleri).

---

## Dosya yapısı

```
shared/src/design.ts                      (yeni) tasarım değerleri
mobile/src/theme/index.ts                 shared'den yeniden dışa aktarır
api/prisma/schema.prisma                  Product, Order, Listing alanları
api/prisma/migrations/0004_promotions/    migration
api/prisma/seed.ts                        ürünler
api/src/modules/promotions/
  promotion.rules.ts                      saf kurallar (uygula/geri al/aktif mi/sıralama anahtarı)
  products.controller.ts                  GET /products, PUT /admin/products/:code
  orders.service.ts                       sipariş oluştur / ödendi işaretle / iade
  orders.controller.ts                    POST /orders, POST /orders/store, GET /me/orders, admin uçları
  payments.controller.ts                  POST /payments/web/callback, POST /payments/web/dev-complete
  promotions.module.ts
api/src/adapters/payments.ts              WebPaymentProvider, StoreVerifier, dev uygulamaları, fabrika
api/src/modules/listings/*                vitrin/acil alanları, showcase, sitemap, facets, urgent filtresi
api/src/modules/media/*                   ?w= genişlikleri
api/src/config/env.ts                     PAYMENTS_MODE, PAYMENT_WEBHOOK_SECRET, WEB_URL, TRUST_PROXY
api/test/promotions.e2e-spec.ts, payments.e2e-spec.ts, showcase.e2e-spec.ts, media-width.e2e-spec.ts
mobile/src/features/promo.ts              etiket/kalan gün yardımcıları
mobile/src/components/PromoBadges.tsx
mobile/src/app/profil/one-cikar/[id].tsx  Öne çıkar ekranı
mobile/src/app/admin/siparisler.tsx, fiyatlar.tsx
web/                                      Next.js sitesi (ayrıntı Task 12-17)
scripts/dev.mjs                           --web, --no-mobile
web/scripts/web-acceptance.mjs            uçtan uca kabul
```

---

### Task 1: React sürümlerini hizala

Kökte `react@19.3.0` + `react-dom@19.2.3` karışık; Next.js tam eşleşme ister, uygulama da iki kopya riski taşıyor. Tek sürüm: 19.2.3 (Expo SDK 57'nin sabitlediği).

**Files:**
- Modify: `package.json` (kök)
- Modify: `mobile/jest.config.js` (react eşlemesini kaldır)
- Modify: `docs/YAPILACAKLAR.md` (React satırını sil)

**Interfaces:** Produces: kökte tek `react`/`react-dom` 19.2.3.

- [ ] **Step 1: Mevcut durumu kanıtla**

Run: `cd C:/AI_WORKSPACE/teknemisatiyorum && npm ls react react-dom 2>&1 | grep -E "react(-dom)?@" | sort | uniq -c`
Expected: 19.3.0 ve 19.2.3 birlikte görünür.

- [ ] **Step 2: Kök `package.json`'a overrides ekle**

```json
{
  "name": "teknemisatiyorum",
  "private": true,
  "workspaces": ["shared", "api", "mobile"],
  "overrides": { "react": "19.2.3", "react-dom": "19.2.3" },
  "scripts": {
    "test": "npm test -w shared && npm test -w api && npm test -w mobile",
    "dev": "node scripts/dev.mjs"
  }
}
```

- [ ] **Step 3: Kur ve doğrula**

Run: `npm install && npm ls react react-dom 2>&1 | grep -E "react(-dom)?@" | sort | uniq -c`
Expected: yalnızca `19.2.3` (deduped satırlar dahil); `mobile/node_modules/react` yok ya da 19.2.3.

- [ ] **Step 4: jest eşlemesini kaldır, testleri çalıştır**

`mobile/jest.config.js`'ten `'^react$'` ve `'^react/(.*)$'` satırlarını ve açıklamasını sil. Run: `cd mobile && npx jest 2>&1 | tail -4`
Expected: tüm testler geçer (özellikle `useRemote`, `usePolling`: "Invalid hook call" yok).

- [ ] **Step 5: `docs/YAPILACAKLAR.md`'den "React sürümleri hizalansın" satırını sil; commit**

```bash
git add package.json package-lock.json mobile/jest.config.js docs/YAPILACAKLAR.md
git commit -m "chore: React tek sürüm (19.2.3) — web için gerekli, uygulamadaki iki kopya riski kalktı"
```

---

### Task 2: Tasarım dilini ortak pakete taşı

**Files:**
- Create: `shared/src/design.ts`
- Modify: `shared/src/index.ts` (dışa aktar)
- Modify: `mobile/src/theme/index.ts`
- Test: `shared/__tests__/design.test.ts`

**Interfaces:** Produces: `colors`, `radius`, `fontFamilies` (`{ heading: 'Space Grotesk', body: 'Inter' }`), `fontWeights`, `typeScale`, `gradients`, `cssVariables(): string` (`:root{--c-bg:#F4EFE6;...}`) — `@tms/shared`'den.

- [ ] **Step 1: Başarısız test**

```ts
// shared/__tests__/design.test.ts
import { colors, cssVariables, radius } from '../src/design';

test('renkler uygulamadaki değerlerle aynı', () => {
  expect(colors.bg).toBe('#F4EFE6');
  expect(colors.primary).toBe('#0F6E68');
  expect(radius.card).toBe(18);
});

test('web için CSS değişkenleri üretilir', () => {
  const css = cssVariables();
  expect(css).toContain('--c-bg:#F4EFE6');
  expect(css).toContain('--c-primary:#0F6E68');
  expect(css).toContain('--r-card:18px');
  expect(css.startsWith(':root{')).toBe(true);
});
```

Run: `cd shared && npx jest design` → Expected: FAIL (modül yok).

- [ ] **Step 2: Uygulama**

```ts
// shared/src/design.ts
/** "Kıyı Sıcak" tasarım dili — uygulama ve site aynı değerleri kullanır (tek kaynak). */
export const colors = {
  bg: '#F4EFE6', card: '#FFFCF6', primary: '#0F6E68', primarySoft: '#5FA8A0', text: '#1D2B2A',
  muted: '#6B736B', surface: '#E7DFD0', line: '#E2D9C8', success: '#2E7D4F', warning: '#C98A1B',
  danger: '#B3261E', white: '#FFFFFF', overlay: 'rgba(29,43,42,0.45)',
} as const;
export const radius = { card: 18, button: 12, chip: 14, sm: 8, xs: 4, lg: 24, pill: 999 } as const;
export const fontFamilies = { heading: 'Space Grotesk', body: 'Inter' } as const;
export const gradients: [string, string][] = [
  ['#5FA8A0', '#0F6E68'], ['#7FB7C9', '#1F5E7A'], ['#9DB8A0', '#3E6B4F'],
  ['#C9B48A', '#7A5A2E'], ['#8FA9C4', '#2F4C6E'], ['#6FB3A8', '#1D4D4A'],
];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** Web için `:root{...}` CSS değişkenleri. */
export function cssVariables(): string {
  const c = Object.entries(colors).map(([k, v]) => `--c-${kebab(k)}:${v}`);
  const r = Object.entries(radius).map(([k, v]) => `--r-${kebab(k)}:${v}px`);
  return `:root{${[...c, ...r].join(';')}}`;
}
```

`shared/src/index.ts`'e ekle: `export * from './design';`

`mobile/src/theme/index.ts` başını değiştir (fonts/type/space aynen kalır):

```ts
export { colors, radius, gradients } from '@tms/shared';
```
ve dosyadaki eski `colors`, `radius`, `gradients` tanımlarını sil.

- [ ] **Step 3: Doğrula**

Run: `cd shared && npx jest && cd ../mobile && npx tsc --noEmit && npx jest theme themeLiterals 2>&1 | tail -3`
Expected: hepsi PASS.

- [ ] **Step 4: Commit**

```bash
git add shared mobile/src/theme
git commit -m "refactor: tasarım dili ortak pakette (uygulama ve site tek kaynak)"
```

---

### Task 3: Veri modeli — ürünler, siparişler, ilan öne çıkarma alanları

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/0004_promotions/migration.sql`
- Modify: `api/prisma/seed.ts`
- Modify: `api/src/modules/listings/listing.view.ts`
- Create: `api/src/modules/promotions/promotion.rules.ts`
- Test: `api/test/promotion-rules.spec.ts` (saf birim testi), `api/test/promotions.e2e-spec.ts`

**Interfaces:**
- Produces (Prisma): `Product { code, kind: ProductKind(vitrin|acil|bump), days Int?, priceWebKurus Int, priceAppKurus Int, iosProductId String?, androidProductId String?, active Boolean, isTrialPrice Boolean, updatedAt }`, `Order { id, userId, listingId, productCode, channel: OrderChannel(web|ios|android|manual), amountKurus Int, status: OrderStatus(pending|paid|failed|refunded|cancelled), providerRef String? @unique, note String?, createdById String?, createdAt, paidAt?, refundedAt? }`, `Listing.featuredUntil/urgentUntil/bumpedAt DateTime?`.
- Produces (TS): `promotion.rules.ts` → `type PromoState = { featuredUntil: Date | null; urgentUntil: Date | null; bumpedAt: Date | null }`, `applyProduct(s: PromoState, p: { kind: 'vitrin'|'acil'|'bump'; days: number | null }, now: Date): PromoState`, `revertProduct(s, p, now): PromoState`, `isActive(until: Date | null, now: Date): boolean`, `freshness(l: { publishedAt: Date | null; bumpedAt: Date | null }): number`.
- Produces (görünüm): `listingView(...)` çıktısına `promo: { featured: boolean; urgent: boolean; featuredUntil?: string; urgentUntil?: string }` (bitişler yalnızca sahibe).

- [ ] **Step 1: Kurallar için başarısız birim testi**

```ts
// api/test/promotion-rules.spec.ts
import { applyProduct, freshness, isActive, revertProduct, type PromoState } from '../src/modules/promotions/promotion.rules';

const now = new Date('2026-10-01T12:00:00Z');
const day = 864e5;
const empty: PromoState = { featuredUntil: null, urgentUntil: null, bumpedAt: null };

test('süreli ürün şimdiden başlar; aktif süre varsa üstüne eklenir', () => {
  const a = applyProduct(empty, { kind: 'vitrin', days: 7 }, now);
  expect(a.featuredUntil!.getTime()).toBe(now.getTime() + 7 * day);
  const b = applyProduct(a, { kind: 'vitrin', days: 7 }, now);
  expect(b.featuredUntil!.getTime()).toBe(now.getTime() + 14 * day);
});

test('süresi dolmuş bitiş yok sayılır', () => {
  const old = { ...empty, urgentUntil: new Date(now.getTime() - day) };
  expect(applyProduct(old, { kind: 'acil', days: 7 }, now).urgentUntil!.getTime()).toBe(now.getTime() + 7 * day);
});

test('üste taşı yalnızca bumpedAt değiştirir', () => {
  const s = applyProduct(empty, { kind: 'bump', days: null }, now);
  expect(s).toEqual({ featuredUntil: null, urgentUntil: null, bumpedAt: now });
});

test('iade süreyi geri çeker ama şimdiden geriye gitmez', () => {
  const s = { ...empty, featuredUntil: new Date(now.getTime() + 10 * day) };
  expect(revertProduct(s, { kind: 'vitrin', days: 7 }, now).featuredUntil!.getTime()).toBe(now.getTime() + 3 * day);
  expect(revertProduct(s, { kind: 'vitrin', days: 30 }, now).featuredUntil!.getTime()).toBe(now.getTime());
});

test('aktiflik ve tazelik', () => {
  expect(isActive(null, now)).toBe(false);
  expect(isActive(new Date(now.getTime() + 1), now)).toBe(true);
  expect(isActive(now, now)).toBe(false);
  const p = new Date('2026-09-01'); const b = new Date('2026-09-20');
  expect(freshness({ publishedAt: p, bumpedAt: b })).toBe(b.getTime());
  expect(freshness({ publishedAt: p, bumpedAt: null })).toBe(p.getTime());
});
```

Run: `cd api && npx jest test/promotion-rules` → Expected: FAIL (modül yok).

- [ ] **Step 2: Kurallar**

```ts
// api/src/modules/promotions/promotion.rules.ts
/** Öne çıkarma kuralları — saf fonksiyonlar (veritabanı ve saat dışarıdan). */
export type PromoState = { featuredUntil: Date | null; urgentUntil: Date | null; bumpedAt: Date | null };
export type PromoProduct = { kind: 'vitrin' | 'acil' | 'bump'; days: number | null };

const DAY = 864e5;
const field = (k: PromoProduct['kind']) => (k === 'vitrin' ? 'featuredUntil' : 'urgentUntil') as 'featuredUntil' | 'urgentUntil';

export const isActive = (until: Date | null, now: Date) => !!until && until.getTime() > now.getTime();

/** Süreli ürün: bitiş = max(şimdi, mevcut bitiş) + gün. Üste taşı: bumpedAt = şimdi. */
export function applyProduct(s: PromoState, p: PromoProduct, now: Date): PromoState {
  if (p.kind === 'bump') return { ...s, bumpedAt: now };
  const f = field(p.kind);
  const base = Math.max(now.getTime(), s[f]?.getTime() ?? 0);
  return { ...s, [f]: new Date(base + (p.days ?? 0) * DAY) };
}

/** İade: süre gün kadar geri çekilir, şimdiden geriye gitmez. Üste taşının geri alınacak etkisi yoktur. */
export function revertProduct(s: PromoState, p: PromoProduct, now: Date): PromoState {
  if (p.kind === 'bump') return s;
  const f = field(p.kind);
  if (!s[f]) return s;
  return { ...s, [f]: new Date(Math.max(now.getTime(), s[f]!.getTime() - (p.days ?? 0) * DAY)) };
}

/** "En yeni" sıralamasının anahtarı. */
export const freshness = (l: { publishedAt: Date | null; bumpedAt: Date | null }) =>
  Math.max(l.publishedAt?.getTime() ?? 0, l.bumpedAt?.getTime() ?? 0);
```

Run: `npx jest test/promotion-rules` → Expected: PASS 5/5.

- [ ] **Step 3: Şema**

`schema.prisma`'ya ekle (Listing modeline üç alan, sonra yeni enum/modeller):

```prisma
// model Listing içine, publishedAt'ın altına:
  /// Öne çıkarma: vitrin ve acil bitişleri, son üste taşınma (sorgu zamanında denetlenir).
  featuredUntil DateTime?
  urgentUntil   DateTime?
  bumpedAt      DateTime?
  orders        Order[]

enum ProductKind {
  vitrin
  acil
  bump
}

enum OrderChannel {
  web
  ios
  android
  manual
}

enum OrderStatus {
  pending
  paid
  failed
  refunded
  cancelled
}

/// Satılan öne çıkarma ürünleri; fiyatlar kuruş, site ve uygulama ayrı (mağaza kesintisi).
model Product {
  code             String      @id
  kind             ProductKind
  days             Int?
  priceWebKurus    Int
  priceAppKurus    Int
  iosProductId     String?
  androidProductId String?
  active           Boolean     @default(true)
  /// Gerçek fiyat girilene kadar true; yönetim ekranında uyarı gösterilir.
  isTrialPrice     Boolean     @default(true)
  updatedAt        DateTime    @updatedAt
  orders           Order[]
}

model Order {
  id          String       @id @default(cuid())
  userId      String
  listingId   String
  listing     Listing      @relation(fields: [listingId], references: [id])
  productCode String
  product     Product      @relation(fields: [productCode], references: [code])
  channel     OrderChannel
  amountKurus Int
  status      OrderStatus  @default(pending)
  /// Sağlayıcının işlem/makbuz referansı; tekil — aynı ödeme iki kez etkinleştirmez.
  providerRef String?      @unique
  note        String?
  createdById String?
  createdAt   DateTime     @default(now())
  paidAt      DateTime?
  refundedAt  DateTime?

  @@index([userId, createdAt])
  @@index([status, createdAt])
}
```

- [ ] **Step 4: Migration SQL'ini üret ve kaydet**

Run (API klasöründe, dev veritabanı açıkken değil; boş şemaya karşı diff):
`npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script --shadow-database-url "$TEST_DB_BASE_URL?schema=shadow_0004" > prisma/migrations/0004_promotions/migration.sql`
Expected: dosyada `CREATE TYPE "ProductKind"`, `CREATE TABLE "Product"`, `CREATE TABLE "Order"`, `ALTER TABLE "Listing" ADD COLUMN "featuredUntil"` satırları. (TEST_DB_BASE_URL `api/jest` kurulumunun kullandığı adres; yoksa `node --env-file=.env --import tsx scripts/db.ts` ile yerel PostgreSQL'i aç ve `.env`'deki `DATABASE_URL` tabanını kullan.) `npx prisma generate`.

- [ ] **Step 5: Seed'e ürünler**

`api/prisma/seed.ts` içinde expertise paketlerinden sonra:

```ts
  // Öne çıkarma ürünleri: deneme fiyatı (1 TL) — gerçek fiyatı yönetici girer.
  const PRODUCTS = [
    { code: 'vitrin_7', kind: 'vitrin', days: 7 }, { code: 'vitrin_30', kind: 'vitrin', days: 30 },
    { code: 'acil_7', kind: 'acil', days: 7 }, { code: 'acil_30', kind: 'acil', days: 30 },
    { code: 'ust_tasi', kind: 'bump', days: null },
  ] as const;
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { code: p.code },
      create: { ...p, priceWebKurus: 100, priceAppKurus: 100, isTrialPrice: true, iosProductId: `tms.${p.code}`, androidProductId: `tms_${p.code}` },
      update: {},
    });
  }
```

Test ortamı seed çalıştırmaz; e2e testleri ürünleri kendi oluşturur (aşağıdaki yardımcı).

- [ ] **Step 6: Görünüm için başarısız e2e testi**

```ts
// api/test/promotions.e2e-spec.ts
import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

export const publish = async (t: TestApp, ownerAuth: Record<string, string>, extra: Record<string, unknown> = {}) => {
  const r = await t.http().post('/listings').set(ownerAuth).send({ brand: 'Promo', model: 'X', year: 2019, lengthM: 11, type: 'yelkenli', price: 100000, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date(), ...extra } });
  return r.body.id as string;
};

test('ilan görünümü vitrin/acil bayraklarını taşır; bitişleri yalnızca sahip görür', async () => {
  const owner = await loginAs(t, { level: 2 });
  const id = await publish(t, owner.auth, { featuredUntil: new Date(Date.now() + 864e5), urgentUntil: new Date(Date.now() - 1000) });
  const pub = await t.http().get(`/listings/${id}`);
  expect(pub.body.promo).toEqual({ featured: true, urgent: false });
  const mine = await t.http().get(`/listings/${id}`).set(owner.auth);
  expect(mine.body.promo.featuredUntil).toBeTruthy();
});
```

Run: `npx jest test/promotions` → Expected: FAIL (`promo` undefined).

- [ ] **Step 7: Görünüme `promo` ekle**

`listing.view.ts` içinde `listingView` dönüşüne, `isMine`'dan önce:

```ts
    /** Öne çıkarma durumu; bitiş tarihleri yalnızca sahibine (ne zaman yenileyeceğini bilsin). */
    promo: (() => {
      const now = new Date();
      const own = !!viewerId && viewerId === l.ownerId;
      return {
        featured: isActive(l.featuredUntil, now),
        urgent: isActive(l.urgentUntil, now),
        ...(own ? { featuredUntil: l.featuredUntil?.toISOString(), urgentUntil: l.urgentUntil?.toISOString() } : {}),
      };
    })(),
```
ve başa `import { isActive } from '../promotions/promotion.rules';`.

Run: `npx jest test/promotions test/promotion-rules` → Expected: PASS.

- [ ] **Step 8: Tüm API takımı + commit**

Run: `npx tsc --noEmit -p . && npm test 2>&1 | grep -E "^Tests:"` → Expected: hepsi geçer.

```bash
git add api/prisma api/src/modules/promotions/promotion.rules.ts api/src/modules/listings/listing.view.ts api/test/promotion-rules.spec.ts api/test/promotions.e2e-spec.ts
git commit -m "feat(api): öne çıkarma veri modeli ve kuralları (ürün, sipariş, vitrin/acil/üste taşı)"
```

---

### Task 4: Ödeme adaptörleri ve ortam ayarları

**Files:**
- Modify: `api/src/config/env.ts`
- Create: `api/src/adapters/payments.ts`
- Modify: `api/.env.example`, `scripts/dev.mjs` (gizli anahtar üretimi), `api/test/setup.ts` (test ortamı değerleri)
- Test: `api/test/payment-adapters.spec.ts`

**Interfaces:**
- Produces: `WEB_PAYMENT`, `STORE_VERIFIER` (DI sembolleri);
  `interface WebPaymentProvider { createCheckout(o: { orderId: string; amountKurus: number }): Promise<{ providerRef: string; checkoutUrl: string }>; verifyCallback(rawBody: string, signature: string | undefined): WebCallback }`;
  `type WebCallback = { providerRef: string; orderId: string; result: 'success' | 'failure'; amountKurus: number }`;
  `interface StoreVerifier { verify(platform: 'ios' | 'android', receipt: string): Promise<{ storeProductId: string; transactionId: string }> }`;
  `class DevWebPayment implements WebPaymentProvider` + `simulate(c: WebCallback): { rawBody: string; signature: string }`;
  `class DevStoreVerifier` (makbuz `dev:<storeProductId>:<rastgele>`);
  `paymentProviders(): { web: WebPaymentProvider; store: StoreVerifier }` (moda göre, `live`/üretim kuralı);
  `signPayload(raw: string): string` (HMAC-SHA256 hex).
- Produces (env): `PAYMENTS_MODE: 'dev'|'live'` (vars. dev), `PAYMENT_WEBHOOK_SECRET` (≥32), `WEB_URL` (vars. `http://localhost:3001`), `TRUST_PROXY` (vars. `loopback`).

- [ ] **Step 1: Başarısız test**

```ts
// api/test/payment-adapters.spec.ts
import { resetEnvCache } from '../src/config/env';
import { DevStoreVerifier, DevWebPayment, paymentProviders, signPayload } from '../src/adapters/payments';

const base = {
  NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(40),
  ID_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PAYMENT_WEBHOOK_SECRET: 's'.repeat(40),
};
const withEnv = (e: Record<string, string>) => { Object.assign(process.env, base, e); resetEnvCache(); };
afterEach(() => { delete process.env.PAYMENTS_MODE; resetEnvCache(); });

test('deneme ödemesi imzalı bildirim üretir ve doğrular', async () => {
  withEnv({});
  const p = new DevWebPayment();
  const { providerRef, checkoutUrl } = await p.createCheckout({ orderId: 'o1', amountKurus: 100 });
  expect(providerRef).toMatch(/^dev_/);
  expect(checkoutUrl).toBe('http://localhost:3001/odeme/deneme?order=o1');
  const { rawBody, signature } = p.simulate({ providerRef, orderId: 'o1', result: 'success', amountKurus: 100 });
  expect(p.verifyCallback(rawBody, signature)).toEqual({ providerRef, orderId: 'o1', result: 'success', amountKurus: 100 });
});

test('imzasız ya da değiştirilmiş bildirim reddedilir', () => {
  withEnv({});
  const p = new DevWebPayment();
  const raw = JSON.stringify({ providerRef: 'dev_1', orderId: 'o1', result: 'success', amountKurus: 100 });
  expect(() => p.verifyCallback(raw, undefined)).toThrow();
  expect(() => p.verifyCallback(raw.replace('100', '1'), signPayload(raw))).toThrow();
});

test('deneme makbuzu biçimi', async () => {
  withEnv({});
  const v = new DevStoreVerifier();
  await expect(v.verify('ios', 'dev:tms.vitrin_7:abc123')).resolves.toEqual({ storeProductId: 'tms.vitrin_7', transactionId: 'dev:tms.vitrin_7:abc123' });
  await expect(v.verify('ios', 'gercek-makbuz')).rejects.toThrow();
});

test('üretimde deneme ödemesi başlamaz; live bu turda bağlanmadı', () => {
  withEnv({ NODE_ENV: 'production', PAYMENTS_MODE: 'dev' });
  expect(() => paymentProviders()).toThrow(/deneme/);
  withEnv({ NODE_ENV: 'development', PAYMENTS_MODE: 'live' });
  expect(() => paymentProviders()).toThrow(/bağlanmadı/);
});
```

Run: `npx jest test/payment-adapters` → Expected: FAIL (modül yok).

- [ ] **Step 2: Ortam ayarları**

`env.ts` şemasına ekle:

```ts
  /** Ödeme sağlayıcıları: dev = deneme (gerçek para yok), live = gerçek (Aşama 2). */
  PAYMENTS_MODE: z.enum(['dev', 'live']).default('dev'),
  /** Ödeme bildirimi imza anahtarı (sanal POS paneli ile aynı değer). */
  PAYMENT_WEBHOOK_SECRET: z.string().min(32, 'PAYMENT_WEBHOOK_SECRET en az 32 karakter olmalı'),
  /** Sitenin adresi (ödeme dönüş ve deneme ödeme sayfası için). */
  WEB_URL: z.string().default('http://localhost:3001'),
  /** Express "trust proxy": yalnızca bu ara katmandan gelen X-Forwarded-For'a güvenilir. */
  TRUST_PROXY: z.string().default('loopback'),
```

`api/.env.example`'a: `PAYMENTS_MODE=dev`, `PAYMENT_WEBHOOK_SECRET=` (boş), `WEB_URL=http://localhost:3001`, `TRUST_PROXY=loopback`.
`scripts/dev.mjs` `.env` üretimine: `.replace(/^PAYMENT_WEBHOOK_SECRET=.*$/m, \`PAYMENT_WEBHOOK_SECRET=${crypto.randomBytes(32).toString('hex')}\`)`; ayrıca mevcut `.env`'de anahtar yoksa ekleyen blok:

```js
// Sonradan eklenen gizli değerler: mevcut .env'de yoksa eklenir (öncekiler değişmez).
{
  let cur = fs.readFileSync(ENV_FILE, 'utf8');
  if (!/^PAYMENT_WEBHOOK_SECRET=.+$/m.test(cur)) {
    cur = cur.replace(/^PAYMENT_WEBHOOK_SECRET=.*\n?/m, '') + `\nPAYMENT_WEBHOOK_SECRET=${crypto.randomBytes(32).toString('hex')}\n`;
    fs.writeFileSync(ENV_FILE, cur);
  }
}
```
`api/test/setup.ts` `Object.assign(process.env, {...})` içine `PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret-test-webhook-secret'`, `PAYMENTS_MODE: 'dev'`, `WEB_URL: 'http://localhost:3001'` ekle. `main.ts`'de `set('trust proxy', 'loopback')` → `set('trust proxy', env().TRUST_PROXY)`.

- [ ] **Step 3: Adaptörler**

```ts
// api/src/adapters/payments.ts
import crypto from 'crypto';
import { AppError } from '../common/errors';
import { safeEqual } from '../common/crypto';
import { env } from '../config/env';

export const WEB_PAYMENT = Symbol('WEB_PAYMENT');
export const STORE_VERIFIER = Symbol('STORE_VERIFIER');

export type WebCallback = { providerRef: string; orderId: string; result: 'success' | 'failure'; amountKurus: number };

/** Sanal POS takma yuvası. Gerçek sağlayıcı (Aşama 2) kendi bildirimini bu biçime çevirir. */
export interface WebPaymentProvider {
  createCheckout(o: { orderId: string; amountKurus: number }): Promise<{ providerRef: string; checkoutUrl: string }>;
  /** İmza doğrulanmadan hiçbir şey döndürmez; bozuk/imzasız bildirimde hata atar. */
  verifyCallback(rawBody: string, signature: string | undefined): WebCallback;
}

/** Mağaza makbuzu takma yuvası (Apple/Google). */
export interface StoreVerifier {
  verify(platform: 'ios' | 'android', receipt: string): Promise<{ storeProductId: string; transactionId: string }>;
}

const badSignature = () => new AppError('BAD_SIGNATURE', 'errors.bad_signature', 400);
const badReceipt = () => new AppError('BAD_RECEIPT', 'errors.bad_receipt', 400);

export const signPayload = (raw: string) => crypto.createHmac('sha256', env().PAYMENT_WEBHOOK_SECRET).update(raw).digest('hex');

/** Deneme sanal POS'u: para çekmez; site deneme sayfası sonucu seçer, sunucu imzalı bildirimi kendisi üretir. */
export class DevWebPayment implements WebPaymentProvider {
  async createCheckout(o: { orderId: string; amountKurus: number }) {
    return { providerRef: `dev_${crypto.randomUUID()}`, checkoutUrl: `${env().WEB_URL}/odeme/deneme?order=${encodeURIComponent(o.orderId)}` };
  }
  verifyCallback(rawBody: string, signature: string | undefined): WebCallback {
    if (!signature || !safeEqual(signPayload(rawBody), signature)) throw badSignature();
    const b = JSON.parse(rawBody) as WebCallback;
    if (typeof b.providerRef !== 'string' || typeof b.orderId !== 'string' || !['success', 'failure'].includes(b.result) || !Number.isInteger(b.amountKurus)) throw badSignature();
    return { providerRef: b.providerRef, orderId: b.orderId, result: b.result, amountKurus: b.amountKurus };
  }
  simulate(c: WebCallback) {
    const rawBody = JSON.stringify(c);
    return { rawBody, signature: signPayload(rawBody) };
  }
}

/** Deneme mağaza doğrulayıcısı: yalnızca `dev:<mağazaÜrünKimliği>:<rastgele>` makbuzları. */
export class DevStoreVerifier implements StoreVerifier {
  async verify(_platform: 'ios' | 'android', receipt: string) {
    const m = /^dev:([\w.]+):([\w-]{6,})$/.exec(receipt);
    if (!m) throw badReceipt();
    return { storeProductId: m[1], transactionId: receipt };
  }
}

/** Moda göre sağlayıcılar. Üretimde deneme modu ve bu turda live başlamayı reddeder. */
export function paymentProviders() {
  const e = env();
  if (e.PAYMENTS_MODE === 'dev') {
    if (e.NODE_ENV === 'production') throw new Error('PAYMENTS_MODE=dev üretimde kullanılamaz (deneme ödemesi para çekmez)');
    return { web: new DevWebPayment(), store: new DevStoreVerifier() };
  }
  throw new Error('PAYMENTS_MODE=live: gerçek ödeme sağlayıcısı henüz bağlanmadı (Aşama 2)');
}
```

- [ ] **Step 4: Doğrula ve commit**

Run: `npx jest test/payment-adapters && npx tsc --noEmit -p .` → Expected: PASS 4/4.

```bash
git add api/src/adapters/payments.ts api/src/config/env.ts api/.env.example api/src/main.ts api/test/setup.ts api/test/payment-adapters.spec.ts scripts/dev.mjs
git commit -m "feat(api): ödeme adaptörleri (deneme sanal POS + mağaza makbuzu), üretim kilidi, imzalı bildirim"
```

---

### Task 5: Herkese açık vitrin, arama ve site haritası uçları

**Files:**
- Modify: `api/src/modules/listings/listings.service.ts`
- Modify: `api/src/modules/listings/listings.controller.ts`
- Test: `api/test/showcase.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 3 `isActive`, `freshness`; `promo` görünümü.
- Produces: `GET /listings?q=&sort=&page=&urgent=1` → `{ items, total, featuredTop: ListingView[] (≤3) }`; `GET /listings/showcase` → `{ featured: ListingView[] (≤8, karışık), urgent: ListingView[] (≤8, en taze) }`; `GET /listings/sitemap` → `{ listings: { id, brand, model, year, type, location, updatedAt }[], facets: { type, location: string | null, count }[] }`. Servis: `search(q, sort, page, opts?: { urgentOnly?: boolean; now?: Date })` → `{ rows, total, featuredTop }`.

- [ ] **Step 1: Başarısız test**

```ts
// api/test/showcase.e2e-spec.ts
import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const DAY = 864e5;
async function listing(ownerAuth: Record<string, string>, data: Record<string, unknown>) {
  const r = await t.http().post('/listings').set(ownerAuth).send({ brand: 'S', model: String(Math.random()), year: 2015, lengthM: 10, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date(Date.now() - 10 * DAY), ...data } });
  return r.body.id as string;
}

test('arama: aramaya uyan en fazla 3 vitrin ilanı üstte; normal listede de yerinde', async () => {
  const u = await loginAs(t, { level: 2 });
  const f = await Promise.all([1, 2, 3, 4].map(() => listing(u.auth, { featuredUntil: new Date(Date.now() + DAY) })));
  const expired = await listing(u.auth, { featuredUntil: new Date(Date.now() - DAY) });
  const sold = await listing(u.auth, { featuredUntil: new Date(Date.now() + DAY) });
  await t.prisma.listing.update({ where: { id: sold }, data: { status: 'sold' } });
  const r = await t.http().get('/listings');
  expect(r.body.featuredTop).toHaveLength(3);
  for (const x of r.body.featuredTop) expect(f).toContain(x.id);
  expect(r.body.featuredTop.map((x: { id: string }) => x.id)).not.toContain(expired);
  expect(r.body.items.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(f));
});

test('üste taşınan ilan "en yeni" sıralamada başa geçer; sadece acil filtresi', async () => {
  const u = await loginAs(t, { level: 2 });
  const bumped = await listing(u.auth, { location: 'Göcek', bumpedAt: new Date() });
  await listing(u.auth, { location: 'Göcek', publishedAt: new Date(Date.now() - DAY) });
  const q = encodeURIComponent(JSON.stringify({ equipment: [], location: 'Göcek' }));
  expect((await t.http().get(`/listings?q=${q}&sort=new`)).body.items[0].id).toBe(bumped);
  const urgent = await listing(u.auth, { location: 'Göcek', urgentUntil: new Date(Date.now() + DAY) });
  const r = await t.http().get(`/listings?q=${q}&urgent=1`);
  expect(r.body.items.map((x: { id: string }) => x.id)).toEqual([urgent]);
});

test('vitrin uç noktası: ≤8 vitrin, ≤8 acil; yalnızca yayındaki ve süresi geçerli', async () => {
  const u = await loginAs(t, { level: 2 });
  await Promise.all(Array.from({ length: 10 }, () => listing(u.auth, { featuredUntil: new Date(Date.now() + DAY), urgentUntil: new Date(Date.now() + DAY) })));
  const r = await t.http().get('/listings/showcase');
  expect(r.body.featured.length).toBe(8);
  expect(r.body.urgent.length).toBe(8);
  expect(r.body.featured.every((x: { promo: { featured: boolean } }) => x.promo.featured)).toBe(true);
});

test('site haritası: yalnızca yayındaki ilanlar ve tip/şehir sayıları', async () => {
  const u = await loginAs(t, { level: 2 });
  const live = await listing(u.auth, { location: 'Fethiye', type: 'motoryat' });
  const removed = await listing(u.auth, { location: 'Fethiye', type: 'motoryat' });
  await t.prisma.listing.update({ where: { id: removed }, data: { status: 'removed' } });
  const r = await t.http().get('/listings/sitemap');
  const ids = r.body.listings.map((x: { id: string }) => x.id);
  expect(ids).toContain(live);
  expect(ids).not.toContain(removed);
  expect(r.body.facets).toEqual(expect.arrayContaining([{ type: 'motoryat', location: 'Fethiye', count: 1 }, { type: 'motoryat', location: null, count: expect.any(Number) }]));
});
```

Run: `npx jest test/showcase` → Expected: FAIL.

- [ ] **Step 2: Servis**

`listings.service.ts`:

```ts
import { freshness, isActive } from '../promotions/promotion.rules';

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // search yerine:
  async search(q: ParsedQuery, sort: Sort, page: number, opts: { urgentOnly?: boolean; now?: Date } = {}, pageSize = 20) {
    const now = opts.now ?? new Date();
    const { rows: all, rates } = await this.match(q);
    const rows = opts.urgentOnly ? all.filter((l) => isActive(l.urgentUntil, now)) : all;
    const tl = (l: ListingRow) => l.price * rates[l.currency];
    if (sort !== 'new') rows.sort((a, b) => (sort === 'asc' ? tl(a) - tl(b) : tl(b) - tl(a)));
    else rows.sort((a, b) => freshness(b) - freshness(a));
    // Aramaya uyan vitrin ilanlarından en fazla 3'ü üstte (karışık); normal listede de yerlerinde kalırlar.
    const featuredTop = shuffle(rows.filter((l) => isActive(l.featuredUntil, now))).slice(0, 3);
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, featuredTop };
  }

  /** Ana sayfa: ≤8 vitrin (karışık), ≤8 acil (en taze). */
  async showcase(now = new Date()) {
    const [featured, urgent] = await Promise.all([
      this.prisma.listing.findMany({ where: { status: 'published', featuredUntil: { gt: now } }, include: listingInclude }),
      this.prisma.listing.findMany({ where: { status: 'published', urgentUntil: { gt: now } }, include: listingInclude }),
    ]);
    return { featured: shuffle(featured).slice(0, 8), urgent: urgent.sort((a, b) => freshness(b) - freshness(a)).slice(0, 8) };
  }

  /** Site haritası ve hazır arama sayfaları: yayındaki ilanlar + tip ve tip×şehir sayıları. */
  async sitemap() {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'published' },
      select: { id: true, brand: true, model: true, year: true, type: true, location: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    const counts = new Map<string, { type: string; location: string | null; count: number }>();
    for (const r of rows) {
      for (const location of [null, r.location]) {
        const k = `${r.type}|${location ?? ''}`;
        const c = counts.get(k) ?? { type: r.type, location, count: 0 };
        c.count++;
        counts.set(k, c);
      }
    }
    return { listings: rows, facets: [...counts.values()] };
  }
```

- [ ] **Step 3: Denetleyici**

`searchQuery`'e `urgent: z.enum(['1']).optional(),` ekle. `search` gövdesi:

```ts
    const { rows, total, featuredTop } = await this.listings.search(q.q, q.sort, q.page, { urgentOnly: q.urgent === '1' });
    const view = (l: (typeof rows)[number]) => this.listings.view(l, u?.id);
    return { items: await Promise.all(rows.map(view)), total, featuredTop: await Promise.all(featuredTop.map(view)) };
```

`@Get('listings/:id')`'den **önce** (rota sırası önemli) ekle:

```ts
  @Public()
  @Get('listings/showcase')
  async showcase(@OptionalUser() u: AuthUser | undefined) {
    const s = await this.listings.showcase();
    const view = (l: ListingRow) => this.listings.view(l, u?.id);
    return { featured: await Promise.all(s.featured.map(view)), urgent: await Promise.all(s.urgent.map(view)) };
  }

  @Public()
  @Get('listings/sitemap')
  sitemap() {
    return this.listings.sitemap();
  }
```
(`import { listingInclude, type ListingRow } from './listing.view';`)

- [ ] **Step 4: Doğrula ve commit**

Run: `npx jest test/showcase test/listings 2>&1 | grep -E "Tests:"` → Expected: PASS (mevcut ilan testleri dahil).

```bash
git add api/src/modules/listings api/test/showcase.e2e-spec.ts
git commit -m "feat(api): vitrin/acil arama ve ana sayfa uçları, üste taşı sıralaması, site haritası"
```

---

### Task 6: Görsel genişlikleri (`/media/:id?w=`)

**Files:**
- Modify: `api/src/modules/media/media.service.ts`, `media.controller.ts`
- Test: `api/test/media-width.e2e-spec.ts`

**Interfaces:** Produces: `GET /media/:id?w=400|800|1600` → `image/webp`, en fazla o genişlik, diskte `<key>.w<w>.webp` önbellek; başka `w` → 400 `BAD_WIDTH`. `w` yoksa eski davranış (jpeg).

- [ ] **Step 1: Başarısız test**

```ts
// api/test/media-width.e2e-spec.ts
import sharp from 'sharp';
import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

test('izinli genişlikte WebP döner; izinsiz genişlik reddedilir', async () => {
  const u = await loginAs(t);
  const id = (await t.http().post('/media').set(u.auth).field('visibility', 'public').attach('file', await jpegWithExif(1800, 1200), 'p.jpg')).body.id;
  const r = await t.http().get(`/media/${id}?w=400`).buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); });
  expect(r.status).toBe(200);
  expect(r.headers['content-type']).toBe('image/webp');
  const meta = await sharp(r.body as Buffer).metadata();
  expect(meta.width).toBe(400);
  expect((await t.http().get(`/media/${id}?w=401`)).status).toBe(400);
  expect((await t.http().get(`/media/${id}`)).headers['content-type']).toBe('image/jpeg');
});
```

Run: `npx jest test/media-width` → Expected: FAIL.

- [ ] **Step 2: Uygulama**

`media.service.ts`:

```ts
export const MEDIA_WIDTHS = [400, 800, 1600] as const;

  /** Herkese açık görselin küçültülmüş WebP'si; ilk istekte üretilir, diskte saklanır. */
  async readPublicWidth(id: string, w: number) {
    if (!(MEDIA_WIDTHS as readonly number[]).includes(w)) throw Errors.bad('BAD_WIDTH', { allowed: MEDIA_WIDTHS.join(',') });
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'public') throw Errors.notFound();
    const gone = await this.prisma.user.count({ where: { id: f.ownerId, deletedAt: { not: null } } });
    if (gone) throw Errors.notFound();
    const key = `${f.key}.w${w}.webp`;
    const cached = await this.storage.get(key).catch(() => null);
    if (cached) return { mime: 'image/webp', data: cached };
    const data = await sharp(await this.storage.get(f.key)).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await this.storage.put(key, data);
    return { mime: 'image/webp', data };
  }
```
(Önce `api/src/adapters/storage.ts`'te `get`'in yoksa hata attığını doğrula; atmıyorsa `null` kontrolü `if (cached?.length)` olur.)

`media.controller.ts` `get`:

```ts
  async get(@Param('id') id: string, @Query('w') w: string | undefined, @Res() res: Response) {
    const f = w === undefined ? await this.media.readPublic(id) : await this.media.readPublicWidth(id, Number(w));
    res.type(f.mime).setHeader('Cache-Control', 'public, max-age=86400').send(f.data);
  }
```

- [ ] **Step 3: Doğrula, çeviri, commit**

`mobile/scripts/i18n/t25.json` ile `errors.bad_width`, `errors.bad_signature`, `errors.bad_receipt` TR/EN (TR: "Geçersiz görsel boyutu", "Ödeme bildirimi doğrulanamadı", "Satın alma makbuzu geçersiz"; EN: "Invalid image width", "Payment notification could not be verified", "Invalid purchase receipt") → `node scripts/i18n-merge.js scripts/i18n/t25.json`.
Run: `cd api && npx jest test/media-width test/media && cd ../mobile && npx jest serverKeys 2>&1 | grep Tests:` → Expected: PASS.

```bash
git add api/src/modules/media api/test/media-width.e2e-spec.ts mobile/src/i18n mobile/scripts/i18n/t25.json
git commit -m "feat(api): görsel genişlikleri (WebP, disk önbelleği)"
```

---

### Task 7: Siparişler ve site ödemesi

**Files:**
- Create: `api/src/modules/promotions/orders.service.ts`, `orders.controller.ts`, `payments.controller.ts`, `products.controller.ts`, `promotions.module.ts`
- Modify: `api/src/app.module.ts` (modülü ekle), `api/src/main.ts` (ham gövde)
- Test: `api/test/payments.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 3 kurallar ve modeller; Task 4 `WEB_PAYMENT`, `STORE_VERIFIER`, `DevWebPayment.simulate`.
- Produces:
  - `OrdersService.create(userId, listingId, productCode, channel: 'web') → { orderId, checkoutUrl }` (ilan yayında + sahibi değilse 409 `LISTING_NOT_PUBLISHED` / 404).
  - `OrdersService.markPaid(where: { id?: string; providerRef?: string }, now = new Date()) → boolean` (tek işlem: koşullu `pending→paid` + ilan süreleri; geçiş olmadıysa false).
  - `OrdersService.markFailed(providerRef)`.
  - `OrdersService.refund(orderId, adminId)`.
  - `OrdersService.view(o)` → `{ id, listingId, listingTitle, productCode, channel, amountKurus, status (24 saatten eski pending → 'cancelled'), createdAt, paidAt }`.
  - HTTP: `GET /products` (herkese açık), `POST /orders` `{ listingId, productCode }` (seviye 1), `GET /me/orders`, `GET /orders/:id` (yalnızca sahibi; yoksa 404), `POST /payments/web/callback` (herkese açık, `X-Signature`), `POST /payments/web/dev-complete` `{ orderId, result }` (yalnızca `PAYMENTS_MODE=dev`, sipariş sahibi).

- [ ] **Step 1: Başarısız testler**

```ts
// api/test/payments.e2e-spec.ts
import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { DevWebPayment } from '../src/adapters/payments';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
  for (const p of [
    { code: 'vitrin_7', kind: 'vitrin', days: 7 }, { code: 'acil_7', kind: 'acil', days: 7 }, { code: 'ust_tasi', kind: 'bump', days: null },
  ] as const) await t.prisma.product.create({ data: { ...p, priceWebKurus: 4900, priceAppKurus: 5900, iosProductId: `tms.${p.code}`, androidProductId: `tms_${p.code}` } });
});
afterAll(async () => { await t.close(); });

const DAY = 864e5;
async function published(auth: Record<string, string>) {
  const r = await t.http().post('/listings').set(auth).send({ brand: 'Pay', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date() } });
  return r.body.id as string;
}
const callback = (body: { rawBody: string; signature: string }) =>
  t.http().post('/payments/web/callback').set('Content-Type', 'application/json').set('X-Signature', body.signature).send(body.rawBody);

test('ürün listesi herkese açık, site ve uygulama fiyatıyla', async () => {
  const r = await t.http().get('/products');
  expect(r.body.find((p: { code: string }) => p.code === 'vitrin_7')).toMatchObject({ kind: 'vitrin', days: 7, priceWebKurus: 4900, priceAppKurus: 5900 });
});

test('sipariş → imzalı başarılı bildirim → vitrin 7 gün açılır', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7' });
  expect(o.status).toBe(201);
  expect(o.body.checkoutUrl).toContain(`/odeme/deneme?order=${o.body.orderId}`);
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  expect(row).toMatchObject({ status: 'pending', amountKurus: 4900, channel: 'web' });
  const sim = new DevWebPayment().simulate({ providerRef: row.providerRef!, orderId: row.id, result: 'success', amountKurus: 4900 });
  expect((await callback(sim)).status).toBe(200);
  const l = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
  expect(l.featuredUntil!.getTime()).toBeGreaterThan(Date.now() + 6.9 * DAY);
  expect((await t.http().get('/me/orders').set(u.auth)).body[0]).toMatchObject({ status: 'paid', productCode: 'vitrin_7' });
});

test('aynı bildirim eşzamanlı iki kez gelirse süre bir kez eklenir', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'acil_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  const sim = new DevWebPayment().simulate({ providerRef: row.providerRef!, orderId: row.id, result: 'success', amountKurus: 4900 });
  await Promise.all([callback(sim), callback(sim)]);
  const l = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
  expect(l.urgentUntil!.getTime()).toBeLessThan(Date.now() + 7.1 * DAY);
});

test('imzasız, yanlış imzalı ya da tutarı farklı bildirim siparişi değiştirmez', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  const good = new DevWebPayment().simulate({ providerRef: row.providerRef!, orderId: row.id, result: 'success', amountKurus: 4900 });
  expect((await t.http().post('/payments/web/callback').set('Content-Type', 'application/json').send(good.rawBody)).status).toBe(400);
  expect((await callback({ rawBody: good.rawBody, signature: 'a'.repeat(64) })).status).toBe(400);
  const cheap = new DevWebPayment().simulate({ providerRef: row.providerRef!, orderId: row.id, result: 'success', amountKurus: 1 });
  expect((await callback(cheap)).status).toBe(409);
  expect((await t.prisma.order.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('pending');
});

test('başarısız ödeme ürünü açmaz; yayında olmayan ya da başkasının ilanına sipariş verilemez', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  await callback(new DevWebPayment().simulate({ providerRef: row.providerRef!, orderId: row.id, result: 'failure', amountKurus: 4900 }));
  expect((await t.prisma.order.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('failed');
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil).toBeNull();
  await t.prisma.listing.update({ where: { id }, data: { status: 'sold' } });
  const sold = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7' });
  expect(sold.status).toBe(409);
  expect(sold.body.code).toBe('LISTING_NOT_PUBLISHED');
  const other = await loginAs(t, { level: 2 });
  const theirs = await published(other.auth);
  expect((await t.http().post('/orders').set(u.auth).send({ listingId: theirs, productCode: 'vitrin_7' })).status).toBe(404);
});

test('sipariş yalnızca sahibine görünür; 24 saatten eski bekleyen iptal görünür', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7' });
  const other = await loginAs(t);
  expect((await t.http().get(`/orders/${o.body.orderId}`).set(other.auth)).status).toBe(404);
  await t.prisma.order.update({ where: { id: o.body.orderId }, data: { createdAt: new Date(Date.now() - 25 * 3600e3) } });
  expect((await t.http().get(`/orders/${o.body.orderId}`).set(u.auth)).body.status).toBe('cancelled');
});

test('deneme tamamlama: yalnızca sipariş sahibi; ürün açılır', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'ust_tasi' });
  const other = await loginAs(t);
  expect((await t.http().post('/payments/web/dev-complete').set(other.auth).send({ orderId: o.body.orderId, result: 'success' })).status).toBe(404);
  expect((await t.http().post('/payments/web/dev-complete').set(u.auth).send({ orderId: o.body.orderId, result: 'success' })).status).toBe(200);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).bumpedAt).toBeTruthy();
});
```

Run: `npx jest test/payments` → Expected: FAIL.

- [ ] **Step 2: Ham gövde (imza için)**

`main.ts` `configureApp` başına: NestFactory'ye `rawBody: true` gerekiyor. `bootstrap`'ta `NestFactory.create(AppModule, { rawBody: true })`; `test/setup.ts`'de `moduleRef.createNestApplication({ rawBody: true })`. Denetleyicide `@Req() req: RawBodyRequest<Request>` ile `req.rawBody!.toString('utf8')`.

- [ ] **Step 3: Servis**

```ts
// api/src/modules/promotions/orders.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type { Order, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { WEB_PAYMENT, type WebPaymentProvider } from '../../adapters/payments';
import { applyProduct, revertProduct } from './promotion.rules';

const PENDING_TTL_MS = 24 * 3600e3;
export const notPublished = () => new AppError('LISTING_NOT_PUBLISHED', 'errors.listing_not_published', 409);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(WEB_PAYMENT) private readonly web: WebPaymentProvider,
  ) {}

  /** Satın alınabilirlik: ilan var, sahibi bu kullanıcı (değilse 404) ve yayında (değilse 409). */
  async assertBuyable(userId: string, listingId: string) {
    const l = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!l || l.ownerId !== userId) throw Errors.notFound();
    if (l.status !== 'published') throw notPublished();
    return l;
  }

  async product(code: string) {
    const p = await this.prisma.product.findUnique({ where: { code } });
    if (!p || !p.active) throw Errors.notFound();
    return p;
  }

  async create(userId: string, listingId: string, productCode: string) {
    await this.assertBuyable(userId, listingId);
    const p = await this.product(productCode);
    const o = await this.prisma.order.create({ data: { userId, listingId, productCode, channel: 'web', amountKurus: p.priceWebKurus } });
    const { providerRef, checkoutUrl } = await this.web.createCheckout({ orderId: o.id, amountKurus: o.amountKurus });
    await this.prisma.order.update({ where: { id: o.id }, data: { providerRef } });
    return { orderId: o.id, checkoutUrl };
  }

  /**
   * Tek veritabanı işleminde: yalnızca hâlâ `pending` olan siparişi `paid` yapar ve ilanın sürelerini uygular.
   * Geçiş olmadıysa (zaten ödendi, iade vb.) false — aynı bildirimin tekrarı etkisizdir.
   */
  async markPaid(where: { id?: string; providerRef?: string }, now = new Date(), tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (db: Prisma.TransactionClient) => {
      const o = await db.order.findFirst({ where, include: { product: true } });
      if (!o) throw Errors.notFound();
      const r = await db.order.updateMany({ where: { id: o.id, status: 'pending' }, data: { status: 'paid', paidAt: now } });
      if (!r.count) return false;
      await db.$queryRaw`SELECT id FROM "Listing" WHERE id = ${o.listingId} FOR UPDATE`;
      const l = await db.listing.findUniqueOrThrow({ where: { id: o.listingId } });
      const next = applyProduct(l, o.product, now);
      await db.listing.update({ where: { id: l.id }, data: next });
      await this.audit.log(o.userId, 'audit.orderPaid', { product: o.productCode, channel: o.channel }, 'order', o.id, db);
      return true;
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  async markFailed(providerRef: string) {
    await this.prisma.order.updateMany({ where: { providerRef, status: 'pending' }, data: { status: 'failed' } });
  }

  async refund(orderId: string, adminId: string, now = new Date()) {
    await this.prisma.$transaction(async (db) => {
      const o = await db.order.findUnique({ where: { id: orderId }, include: { product: true } });
      if (!o) throw Errors.notFound();
      const r = await db.order.updateMany({ where: { id: o.id, status: 'paid' }, data: { status: 'refunded', refundedAt: now } });
      if (!r.count) throw new AppError('NOT_REFUNDABLE', 'errors.not_refundable', 409);
      await db.$queryRaw`SELECT id FROM "Listing" WHERE id = ${o.listingId} FOR UPDATE`;
      const l = await db.listing.findUniqueOrThrow({ where: { id: o.listingId } });
      await db.listing.update({ where: { id: l.id }, data: revertProduct(l, o.product, now) });
      await this.audit.log(adminId, 'audit.orderRefunded', { product: o.productCode, amount: String(o.amountKurus) }, 'order', o.id, db);
    });
  }

  view(o: Order & { listing?: { brand: string; model: string } }, now = new Date()) {
    const stale = o.status === 'pending' && now.getTime() - o.createdAt.getTime() > PENDING_TTL_MS;
    return {
      id: o.id, listingId: o.listingId, listingTitle: o.listing ? `${o.listing.brand} ${o.listing.model}` : null,
      productCode: o.productCode, channel: o.channel, amountKurus: o.amountKurus,
      status: stale ? 'cancelled' : o.status, createdAt: o.createdAt, paidAt: o.paidAt,
    };
  }
}
```

- [ ] **Step 4: Denetleyiciler ve modül**

```ts
// api/src/modules/promotions/products.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list() {
    const rows = await this.prisma.product.findMany({ where: { active: true }, orderBy: [{ kind: 'asc' }, { days: 'asc' }] });
    return rows.map((p) => ({ code: p.code, kind: p.kind, days: p.days, priceWebKurus: p.priceWebKurus, priceAppKurus: p.priceAppKurus, iosProductId: p.iosProductId, androidProductId: p.androidProductId, isTrialPrice: p.isTrialPrice }));
  }
}
```

```ts
// api/src/modules/promotions/orders.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { OrdersService } from './orders.service';

const orderBody = z.object({ listingId: z.string().min(1), productCode: z.string().min(1).max(40) });

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly prisma: PrismaService) {}

  @Auth({ level: 1 })
  @Post('orders')
  create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(orderBody)) b: z.infer<typeof orderBody>) {
    return this.orders.create(u.id, b.listingId, b.productCode);
  }

  @Auth()
  @Get('me/orders')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.order.findMany({ where: { userId: u.id }, include: { listing: { select: { brand: true, model: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((o) => this.orders.view(o));
  }

  @Auth()
  @Get('orders/:id')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId: u.id }, include: { listing: { select: { brand: true, model: true } } } });
    if (!o) throw Errors.notFound();
    return this.orders.view(o);
  }
}
```

```ts
// api/src/modules/promotions/payments.controller.ts
import { Body, Controller, Headers, HttpCode, Inject, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { env } from '../../config/env';
import { DevWebPayment, WEB_PAYMENT, type WebPaymentProvider } from '../../adapters/payments';
import { OrdersService } from './orders.service';

const devBody = z.object({ orderId: z.string().min(1), result: z.enum(['success', 'failure']) });

@Controller('payments/web')
export class PaymentsController {
  constructor(private readonly orders: OrdersService, private readonly prisma: PrismaService, @Inject(WEB_PAYMENT) private readonly web: WebPaymentProvider) {}

  /** Sanal POS'un sunucuya bildirimi. Tarayıcının dönüş sayfası sonucu belirlemez; yalnızca bu. */
  @Public()
  @Post('callback')
  @HttpCode(200)
  async callback(@Req() req: RawBodyRequest<Request>, @Headers('x-signature') sig: string | undefined) {
    const c = this.web.verifyCallback(req.rawBody?.toString('utf8') ?? '', sig);
    const o = await this.prisma.order.findFirst({ where: { id: c.orderId, providerRef: c.providerRef } });
    if (!o) throw Errors.notFound();
    if (o.amountKurus !== c.amountKurus) throw new AppError('AMOUNT_MISMATCH', 'errors.amount_mismatch', 409);
    if (c.result === 'failure') await this.orders.markFailed(c.providerRef);
    else await this.orders.markPaid({ providerRef: c.providerRef });
    return { ok: true };
  }

  /** Yalnızca deneme modu: site deneme sayfasındaki düğmeler; sunucu imzalı bildirimi üretip aynı yoldan işler. */
  @Auth()
  @Post('dev-complete')
  @HttpCode(200)
  async devComplete(@CurrentUser() u: AuthUser, @Body(new ZodPipe(devBody)) b: z.infer<typeof devBody>) {
    if (env().PAYMENTS_MODE !== 'dev' || !(this.web instanceof DevWebPayment)) throw Errors.notFound();
    const o = await this.prisma.order.findFirst({ where: { id: b.orderId, userId: u.id } });
    if (!o || !o.providerRef) throw Errors.notFound();
    const sim = this.web.simulate({ providerRef: o.providerRef, orderId: o.id, result: b.result, amountKurus: o.amountKurus });
    const c = this.web.verifyCallback(sim.rawBody, sim.signature);
    if (c.result === 'failure') await this.orders.markFailed(c.providerRef);
    else await this.orders.markPaid({ providerRef: c.providerRef });
    return { ok: true };
  }
}
```

```ts
// api/src/modules/promotions/promotions.module.ts
import { Module } from '@nestjs/common';
import { paymentProviders, STORE_VERIFIER, WEB_PAYMENT } from '../../adapters/payments';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentsController } from './payments.controller';
import { ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController, OrdersController, PaymentsController],
  providers: [
    OrdersService,
    { provide: 'PAYMENT_PROVIDERS', useFactory: paymentProviders },
    { provide: WEB_PAYMENT, useFactory: (p: ReturnType<typeof paymentProviders>) => p.web, inject: ['PAYMENT_PROVIDERS'] },
    { provide: STORE_VERIFIER, useFactory: (p: ReturnType<typeof paymentProviders>) => p.store, inject: ['PAYMENT_PROVIDERS'] },
  ],
  exports: [OrdersService],
})
export class PromotionsModule {}
```

`app.module.ts` imports'a `PromotionsModule` ekle.

- [ ] **Step 5: Doğrula**

Run: `npx jest test/payments 2>&1 | grep -E "Tests:|●"` → Expected: PASS 7/7.
Çeviriler: `mobile/scripts/i18n/t26.json` → `errors.listing_not_published` (varsa atla), `errors.amount_mismatch` ("Ödeme tutarı siparişle uyuşmuyor"/"Payment amount does not match the order"), `errors.not_refundable` ("Bu sipariş iade edilemez"/"This order can't be refunded"), `audit.orderPaid` ("Sipariş ödendi: {{product}} ({{channel}})"/"Order paid: {{product}} ({{channel}})"), `audit.orderRefunded` ("Sipariş iade edildi: {{product}}"/"Order refunded: {{product}}"). Run: `cd mobile && npx jest serverKeys` → PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src api/test/payments.e2e-spec.ts api/test/setup.ts mobile/src/i18n mobile/scripts/i18n/t26.json
git commit -m "feat(api): siparişler ve site ödemesi (imzalı bildirim, tek etkinleştirme, deneme tamamlama)"
```

---

### Task 8: Uygulama (mağaza) satın alması

**Files:**
- Modify: `api/src/modules/promotions/orders.service.ts`, `orders.controller.ts`
- Test: `api/test/payments.e2e-spec.ts` (ekleme)

**Interfaces:**
- Consumes: Task 4 `STORE_VERIFIER`, Task 7 `markPaid`, `assertBuyable`.
- Produces: `POST /orders/store` `{ listingId, platform: 'ios'|'android', receipt }` → `{ orderId, status: 'paid' }`; aynı makbuz ikinci kez → 409 `RECEIPT_USED`; makbuzdaki mağaza ürünü bilinmiyorsa 400 `BAD_RECEIPT`. `OrdersService.createFromStore(userId, listingId, platform, receipt)`.

- [ ] **Step 1: Başarısız test (payments.e2e-spec.ts sonuna)**

```ts
test('mağaza makbuzu: doğrulanır, ürün açılır; aynı makbuz ikinci kez kullanılamaz', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const receipt = `dev:tms.acil_7:${Date.now()}abc`;
  const r = await t.http().post('/orders/store').set(u.auth).send({ listingId: id, platform: 'ios', receipt });
  expect(r.status).toBe(201);
  expect(r.body.status).toBe('paid');
  const o = await t.prisma.order.findUniqueOrThrow({ where: { id: r.body.orderId } });
  expect(o).toMatchObject({ channel: 'ios', amountKurus: 5900, productCode: 'acil_7' });
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).urgentUntil).toBeTruthy();
  const again = await t.http().post('/orders/store').set(u.auth).send({ listingId: id, platform: 'ios', receipt });
  expect(again.status).toBe(409);
  expect(again.body.code).toBe('RECEIPT_USED');
  expect((await t.http().post('/orders/store').set(u.auth).send({ listingId: id, platform: 'android', receipt: 'dev:bilinmeyen:abcdef' })).status).toBe(400);
});
```

Run: `npx jest test/payments -t "mağaza"` → Expected: FAIL.

- [ ] **Step 2: Uygulama**

`OrdersService` constructor'a `@Inject(STORE_VERIFIER) private readonly store: StoreVerifier` ekle ve:

```ts
  /** Mağaza satın alması: makbuz doğrulanır, sipariş `paid` olarak oluşur ve aynı işlemde etkinleşir. */
  async createFromStore(userId: string, listingId: string, platform: 'ios' | 'android', receipt: string) {
    await this.assertBuyable(userId, listingId);
    const { storeProductId, transactionId } = await this.store.verify(platform, receipt);
    const p = await this.prisma.product.findFirst({ where: platform === 'ios' ? { iosProductId: storeProductId, active: true } : { androidProductId: storeProductId, active: true } });
    if (!p) throw new AppError('BAD_RECEIPT', 'errors.bad_receipt', 400);
    const providerRef = `${platform}:${transactionId}`;
    try {
      return await this.prisma.$transaction(async (db) => {
        const o = await db.order.create({ data: { userId, listingId, productCode: p.code, channel: platform, amountKurus: p.priceAppKurus, providerRef } });
        await this.markPaid({ id: o.id }, new Date(), db);
        return { orderId: o.id, status: 'paid' as const };
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new AppError('RECEIPT_USED', 'errors.receipt_used', 409);
      throw e;
    }
  }
```

`orders.controller.ts`:

```ts
const storeBody = z.object({ listingId: z.string().min(1), platform: z.enum(['ios', 'android']), receipt: z.string().min(6).max(20000) });

  @Auth({ level: 1 })
  @Post('orders/store')
  store(@CurrentUser() u: AuthUser, @Body(new ZodPipe(storeBody)) b: z.infer<typeof storeBody>) {
    return this.orders.createFromStore(u.id, b.listingId, b.platform, b.receipt);
  }
```
Çeviri `errors.receipt_used` ("Bu satın alma zaten kullanıldı"/"This purchase was already used") → `t27.json`.

- [ ] **Step 3: Doğrula ve commit**

Run: `npx jest test/payments && cd ../mobile && npx jest serverKeys 2>&1 | grep Tests:` → Expected: PASS.

```bash
git add api/src/modules/promotions api/test/payments.e2e-spec.ts mobile/src/i18n mobile/scripts/i18n/t27.json
git commit -m "feat(api): mağaza makbuzuyla satın alma (tek kullanımlık makbuz)"
```

---

### Task 9: Yönetim — siparişler, elle etkinleştirme, iade, fiyatlar

**Files:**
- Create: `api/src/modules/promotions/admin-orders.controller.ts`
- Modify: `promotions.module.ts`
- Test: `api/test/admin-orders.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 7 `OrdersService.markPaid`, `refund`, `view`.
- Produces (yalnızca `admin` rolü): `GET /admin/orders?status=` → görünüm listesi (+ `userName`); `POST /admin/orders/manual` `{ listingId, productCode, note }` → `{ orderId }` (kendi ilanı 403 `SELF_DECISION`, yayında değil 409); `POST /admin/orders/:id/refund` → 204; `PUT /admin/products/:code` `{ priceWebKurus?, priceAppKurus?, active? }` → ürün (fiyat girilince `isTrialPrice=false`); hepsi işlem kaydına.

- [ ] **Step 1: Başarısız test**

```ts
// api/test/admin-orders.e2e-spec.ts
import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
  await t.prisma.product.create({ data: { code: 'vitrin_30', kind: 'vitrin', days: 30, priceWebKurus: 100, priceAppKurus: 100 } });
});
afterAll(async () => { await t.close(); });

async function published(auth: Record<string, string>) {
  const r = await t.http().post('/listings').set(auth).send({ brand: 'Adm', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date() } });
  return r.body.id as string;
}

test('yönetici havale siparişi oluşturur, iade eder; süre geri çekilir; kayıt düşer', async () => {
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });
  const seller = await loginAs(t, { level: 2 });
  const id = await published(seller.auth);
  const noNote = await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: id, productCode: 'vitrin_30' });
  expect(noNote.status).toBe(400);
  const r = await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: id, productCode: 'vitrin_30', note: 'Dekont 12345' });
  expect(r.status).toBe(201);
  const until = (await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil!;
  expect(until.getTime()).toBeGreaterThan(Date.now() + 29 * 864e5);
  const list = await t.http().get('/admin/orders').set(admin.auth);
  expect(list.body.find((o: { id: string }) => o.id === r.body.orderId)).toMatchObject({ channel: 'manual', status: 'paid' });
  expect((await t.http().post(`/admin/orders/${r.body.orderId}/refund`).set(admin.auth)).status).toBe(204);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil!.getTime()).toBeLessThan(Date.now() + 864e5);
  expect((await t.http().post(`/admin/orders/${r.body.orderId}/refund`).set(admin.auth)).status).toBe(409);
  expect(await t.prisma.auditLog.count({ where: { targetId: r.body.orderId } })).toBeGreaterThanOrEqual(2);
});

test('moderatör yapamaz; yönetici kendi ilanına yapamaz', async () => {
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });
  const own = await published(admin.auth);
  expect((await t.http().get('/admin/orders').set(mod.auth)).status).toBe(403);
  const self = await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: own, productCode: 'vitrin_30', note: 'x' });
  expect(self.status).toBe(403);
  expect(self.body.code).toBe('SELF_DECISION');
});

test('fiyat değişikliği deneme işaretini kaldırır ve kayda düşer', async () => {
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });
  const r = await t.http().put('/admin/products/vitrin_30').set(admin.auth).send({ priceWebKurus: 149900, priceAppKurus: 179900 });
  expect(r.body).toMatchObject({ priceWebKurus: 149900, priceAppKurus: 179900, isTrialPrice: false });
  expect(await t.prisma.auditLog.count({ where: { action: 'audit.productPriceChanged', targetId: 'vitrin_30' } })).toBe(1);
});
```

Run: `npx jest test/admin-orders` → Expected: FAIL.

- [ ] **Step 2: Uygulama**

```ts
// api/src/modules/promotions/admin-orders.controller.ts
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { notPublished, OrdersService } from './orders.service';

const ADMIN = { roles: ['admin'] as ('admin')[] };
const manualBody = z.object({ listingId: z.string().min(1), productCode: z.string().min(1), note: z.string().trim().min(3).max(200) });
const priceBody = z.object({
  priceWebKurus: z.number().int().min(100).max(100_000_000).optional(),
  priceAppKurus: z.number().int().min(100).max(100_000_000).optional(),
  active: z.boolean().optional(),
});

@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService, private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Auth(ADMIN)
  @Get('orders')
  async list(@Query('status') status?: string) {
    const valid = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];
    const rows = await this.prisma.order.findMany({
      where: status && valid.includes(status) ? { status: status as never } : {},
      include: { listing: { select: { brand: true, model: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    return rows.map((o) => ({ ...this.orders.view(o), note: o.note, userName: users.find((x) => x.id === o.userId)?.name ?? null }));
  }

  /** Havale/EFT: yönetici siparişi açıklamasıyla oluşturur ve aynı işlemde öder. */
  @Auth(ADMIN)
  @Post('orders/manual')
  async manual(@CurrentUser() u: AuthUser, @Body(new ZodPipe(manualBody)) b: z.infer<typeof manualBody>) {
    const l = await this.prisma.listing.findUnique({ where: { id: b.listingId } });
    if (!l) throw Errors.notFound();
    if (l.ownerId === u.id) throw new AppError('SELF_DECISION', 'errors.self_decision', 403);
    if (l.status !== 'published') throw notPublished();
    const p = await this.orders.product(b.productCode);
    const orderId = await this.prisma.$transaction(async (db) => {
      const o = await db.order.create({ data: { userId: l.ownerId, listingId: l.id, productCode: p.code, channel: 'manual', amountKurus: p.priceWebKurus, note: b.note, createdById: u.id } });
      await this.orders.markPaid({ id: o.id }, new Date(), db);
      await this.audit.log(u.id, 'audit.orderManual', { product: p.code, note: b.note }, 'order', o.id, db);
      return o.id;
    });
    return { orderId };
  }

  @Auth(ADMIN)
  @Post('orders/:id/refund')
  @HttpCode(204)
  async refund(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.orders.refund(id, u.id);
  }

  @Auth(ADMIN)
  @Put('products/:code')
  async price(@CurrentUser() u: AuthUser, @Param('code') code: string, @Body(new ZodPipe(priceBody)) b: z.infer<typeof priceBody>) {
    await this.orders.product(code).catch(async () => { if (!(await this.prisma.product.findUnique({ where: { code } }))) throw Errors.notFound(); });
    const priced = b.priceWebKurus !== undefined || b.priceAppKurus !== undefined;
    const p = await this.prisma.product.update({ where: { code }, data: { ...b, ...(priced ? { isTrialPrice: false } : {}) } });
    await this.audit.log(u.id, 'audit.productPriceChanged', { code, web: String(p.priceWebKurus), app: String(p.priceAppKurus) }, 'product', code);
    return p;
  }
}
```

`promotions.module.ts` controllers'a `AdminOrdersController` ekle. Çeviri `t28.json`: `audit.orderManual` ("Havale siparişi: {{product}} ({{note}})"/"Bank transfer order: {{product}} ({{note}})"), `audit.productPriceChanged` ("Ürün fiyatı: {{code}} site {{web}} / uygulama {{app}} kuruş"/"Product price: {{code}} web {{web}} / app {{app}} kuruş").

- [ ] **Step 3: Doğrula ve commit**

Run: `npx jest test/admin-orders && npm test 2>&1 | grep -E "^Tests:"` ve `cd ../mobile && npx jest serverKeys` → Expected: PASS.

```bash
git add api/src/modules/promotions api/test/admin-orders.e2e-spec.ts mobile/src/i18n mobile/scripts/i18n/t28.json
git commit -m "feat(api): yönetim — havale siparişi, iade, ürün fiyatları"
```

---

### Task 10: Uygulama — etiketler, vitrin şeridi, Öne çıkar ekranı, yönetim ekranları

**Files:**
- Create: `mobile/src/features/promo.ts`, `mobile/src/components/PromoBadges.tsx`, `mobile/src/app/profil/one-cikar/[id].tsx`, `mobile/src/app/admin/siparisler.tsx`, `mobile/src/app/admin/fiyatlar.tsx`
- Modify: `mobile/src/services/types.ts` (`Listing.promo`), `services/api/mappers.ts` (`toListing`), `services/actions.ts` (ürünler, satın alma, yönetim), `components/ListingCard.tsx` (etiketler), `app/(tabs)/kesfet.tsx` (vitrin şeridi), `app/profil/ilanlarim.tsx` (durum + "Öne çıkar"), `app/admin/_layout.tsx` (iki sekme), i18n
- Test: `mobile/__tests__/promo.test.ts`, `mobile/__tests__/promoMapper.test.ts`

**Interfaces:**
- Consumes: API `promo`, `GET /products`, `POST /orders/store`, `GET /listings/showcase`, admin uçları.
- Produces: `promo.ts` → `daysLeft(until?: string, now?: Date): number | null`, `formatKurus(k: number, lang: 'tr'|'en'): string`, `devReceipt(storeProductId: string): string`; `actions.products()`, `actions.buyInApp(listingId, product)`, `actions.showcase()`, `actions.adminOrders(status?)`, `actions.adminManualOrder(listingId, productCode, note)`, `actions.adminRefund(orderId)`, `actions.adminSetPrice(code, patch)`.

- [ ] **Step 1: Başarısız testler**

```ts
// mobile/__tests__/promo.test.ts
import { daysLeft, devReceipt, formatKurus } from '@/features/promo';

test('kalan gün yukarı yuvarlanır; geçmiş/eksik bitiş null', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  expect(daysLeft('2026-10-03T13:00:00Z', now)).toBe(3);
  expect(daysLeft('2026-09-30T00:00:00Z', now)).toBeNull();
  expect(daysLeft(undefined, now)).toBeNull();
});
test('kuruş biçimi', () => {
  expect(formatKurus(149900, 'tr')).toBe('₺1.499');
  expect(formatKurus(100, 'en')).toBe('₺1');
});
test('deneme makbuzu sunucunun beklediği biçimde', () => {
  expect(devReceipt('tms.vitrin_7')).toMatch(/^dev:tms\.vitrin_7:[\w-]{6,}$/);
});
```

```ts
// mobile/__tests__/promoMapper.test.ts
import { toListing } from '@/services/api/mappers';
const base = { id: 'l1', brand: 'B', model: 'M', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum', equipment: [], cabins: 0, engine: '', description: '', status: 'published', badges: [], photos: [], seller: { id: 's', name: 'S', since: 2020, companyName: null }, logbook: null, isMine: false, createdAt: '2026-09-01', publishedAt: '2026-09-01' };
test('öne çıkarma bilgisi ilana taşınır', () => {
  expect(toListing({ ...base, promo: { featured: true, urgent: false, featuredUntil: '2026-10-09T00:00:00Z' } } as never).promo).toEqual({ featured: true, urgent: false, featuredUntil: '2026-10-09T00:00:00Z' });
  expect(toListing(base as never).promo).toEqual({ featured: false, urgent: false });
});
```

Run: `cd mobile && npx jest promo` → Expected: FAIL.

- [ ] **Step 2: Yardımcılar ve eşleyici**

```ts
// mobile/src/features/promo.ts
/** Öne çıkarma bitişine kalan gün (yukarı yuvarlanır); bitmişse ya da yoksa null. */
export function daysLeft(until?: string, now = new Date()): number | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 864e5) : null;
}
/** Kuruş → "₺1.499" (tam lira; ürün fiyatları kuruşsuz girilir). */
export function formatKurus(k: number, lang: 'tr' | 'en') {
  return `₺${Math.round(k / 100).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}`;
}
/** Deneme mağaza makbuzu (yalnızca PAYMENTS_MODE=dev sunucuda geçer). */
export const devReceipt = (storeProductId: string) => `dev:${storeProductId}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
```

`types.ts` `Listing`'e: `promo?: { featured: boolean; urgent: boolean; featuredUntil?: string; urgentUntil?: string };`
`mappers.ts` `ApiListing`'e `promo?: {...}` ve `toListing` dönüşüne `promo: l.promo ?? { featured: false, urgent: false },`.

Run: `npx jest promo` → Expected: PASS.

- [ ] **Step 3: Eylemler**

`actions.ts`'e (api modu; demo modunda boş/yerel):

```ts
  async products() {
    if (!isApiMode()) return [] as ApiProduct[];
    return api.get<ApiProduct[]>('/products');
  },
  /** Uygulama içi satın alma. Bu turda mağaza modülü yok: deneme makbuzu (sunucu yalnızca deneme modunda kabul eder). */
  async buyInApp(listingId: string, p: ApiProduct) {
    const platform = Platform.OS === 'android' ? 'android' : 'ios';
    const storeId = platform === 'ios' ? p.iosProductId : p.androidProductId;
    if (!storeId) throw new ApiError(400, 'BAD_RECEIPT', 'errors.bad_receipt');
    await api.post('/orders/store', { listingId, platform, receipt: devReceipt(storeId) });
    await syncMine();
  },
  async showcase() {
    if (!isApiMode()) return { featured: g().listings.filter((l) => l.promo?.featured), urgent: g().listings.filter((l) => l.promo?.urgent) };
    const r = await api.get<{ featured: ApiListing[]; urgent: ApiListing[] }>('/listings/showcase');
    return { featured: r.featured.map(toListing), urgent: r.urgent.map(toListing) };
  },
  adminOrders: (status?: string) => api.get<AdminOrder[]>(`/admin/orders${status ? `?status=${status}` : ''}`),
  adminManualOrder: (listingId: string, productCode: string, note: string) => api.post('/admin/orders/manual', { listingId, productCode, note }),
  adminRefund: (orderId: string) => api.post(`/admin/orders/${orderId}/refund`),
  adminSetPrice: (code: string, patch: { priceWebKurus?: number; priceAppKurus?: number }) => api.put(`/admin/products/${code}`, patch),
```
Tipler (`mappers.ts`): `export interface ApiProduct { code: string; kind: 'vitrin' | 'acil' | 'bump'; days: number | null; priceWebKurus: number; priceAppKurus: number; iosProductId: string | null; androidProductId: string | null; isTrialPrice: boolean }` ve `export interface AdminOrder { id: string; listingId: string; listingTitle: string | null; productCode: string; channel: string; amountKurus: number; status: string; createdAt: string; paidAt: string | null; note: string | null; userName: string | null }`. `ApiError`'u `./api/client`'tan, `devReceipt`'i `@/features/promo`'dan içe aktar.

- [ ] **Step 4: Ekranlar**

`components/PromoBadges.tsx`:

```tsx
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import type { Listing } from '@/services';
import { T } from './T';

/** İlan kartı ve detayında "Vitrin" / "Acil" etiketleri. */
export function PromoBadges({ promo }: { promo?: Listing['promo'] }) {
  const { t } = useTranslation();
  if (!promo?.featured && !promo?.urgent) return null;
  const pill = (label: string, bg: string) => (
    <View key={label} style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(0.5) }}>
      <T variant="label" color={colors.white}>{label}</T>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: space(1.5) }}>
      {promo.featured ? pill(t('promo.featured'), colors.primary) : null}
      {promo.urgent ? pill(t('promo.urgent'), colors.danger) : null}
    </View>
  );
}
```
`ListingCard.tsx`'te başlığın üstüne `<PromoBadges promo={listing.promo} />`; `components/index.ts`'e dışa aktar.

`app/profil/one-cikar/[id].tsx` (ürün listesi; api modunda `actions.products()`; her ürün satırı: ad (`t('promo.product.<code>')`), süre, uygulama fiyatı `formatKurus(p.priceAppKurus)`, `isTrialPrice` ise "deneme fiyatı" notu; "Satın al (deneme)" düğmesi → `attempt(() => actions.buyInApp(id, p))` → `showDemoToast(t('promo.bought'))` → `router.back()`; demo modunda `demoOnly` sarmalı):

```tsx
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Header, Screen, T, showDemoToast } from '@/components';
import { demoOnly } from '@/components/DemoOnly';
import { actions } from '@/services';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';
import { formatKurus } from '@/features/promo';

/** İlanını öne çıkar: Vitrin / Acil / Üste taşı. Bu turda mağaza ödemesi deneme modunda. */
function OneCikar() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const products = useRemote(() => actions.products()).data ?? [];
  const buy = (p: (typeof products)[number]) => attempt(async () => {
    await actions.buyInApp(id, p);
    showDemoToast(t('promo.bought'));
    router.back();
  });
  return (
    <Screen>
      <Header title={t('promo.title')} />
      <T color={colors.muted}>{t('promo.intro')}</T>
      {products.map((p) => (
        <Card key={p.code}>
          <T variant="h3">{t(`promo.product.${p.code}`)}</T>
          <T variant="caption" color={colors.muted}>{t(`promo.kindHint.${p.kind}`)}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(2) }}>
            <View>
              <T variant="h2">{formatKurus(p.priceAppKurus, currentLang())}</T>
              {p.isTrialPrice ? <T variant="caption" color={colors.warning}>{t('promo.trialPrice')}</T> : null}
            </View>
            <Button small title={t('promo.buyDev')} onPress={() => buy(p)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
export default demoOnly(OneCikar);
```

`ilanlarim.tsx`: yayındaki her ilan kartına `daysLeft(l.promo?.featuredUntil)` ve `daysLeft(l.promo?.urgentUntil)` varsa "Vitrinde · N gün" / "Acil · N gün" satırı ve `router.push(\`/profil/one-cikar/${l.id}\`)` düğmesi (`t('promo.cta')`).
`(tabs)/kesfet.tsx`: başa `useRemote(() => actions.showcase())`; `featured.length` ise yatay kaydırmalı "Vitrin" şeridi (`ListingCard` compact).
`admin/siparisler.tsx`: `useRemote(() => actions.adminOrders())`; her satır: ilan, ürün, kanal, `formatKurus`, durum; `paid` ise "İade et" (`attempt(() => actions.adminRefund(o.id))` + `reload`). Üstte "Havale siparişi" formu: ilan kimliği `Field`, ürün `Chip` seçimi, açıklama `Field`, "Oluştur".
`admin/fiyatlar.tsx`: ürün başına iki `Field` (site/uygulama TL), "Kaydet" → `adminSetPrice(code, { priceWebKurus: tl*100, priceAppKurus: tl*100 })`; `isTrialPrice` ise uyarı satırı (`t('promo.trialWarning')`).
`admin/_layout.tsx`: mevcut sekme dizisine `siparisler`, `fiyatlar` ekle (`t('admin.nav.orders')`, `t('admin.nav.prices')`); yalnızca `admin` rolünde göster (oturum `staff` + `roles` bilgisi yoksa: `useSession().staff` ve sunucu 403 → `showError`).

Çeviri `t29.json` (TR/EN): `promo.featured` Vitrin/Featured, `promo.urgent` Acil/Urgent, `promo.title` "İlanını öne çıkar"/"Promote your listing", `promo.intro`, `promo.product.vitrin_7` "Vitrin · 7 gün", `vitrin_30`, `acil_7`, `acil_30`, `ust_tasi` "Üste taşı", `promo.kindHint.vitrin|acil|bump`, `promo.trialPrice` "Deneme fiyatı", `promo.buyDev` "Satın al (deneme)", `promo.bought` "Öne çıkarma etkin", `promo.cta` "Öne çıkar", `promo.activeFeatured` "Vitrinde · {{n}} gün", `promo.activeUrgent` "Acil · {{n}} gün", `promo.trialWarning` "Gerçek fiyat girilmedi — deneme fiyatı geçerli", `admin.nav.orders` Siparişler, `admin.nav.prices` Fiyatlar, `admin.manualOrder`, `admin.refund`, `admin.note`, `admin.listingId`, `admin.create`, `admin.save`, `home.showcase` Vitrin.

- [ ] **Step 5: Doğrula**

Run: `cd mobile && npx tsc --noEmit && npx jest 2>&1 | grep -E "^Tests:" && npx expo lint 2>&1 | grep -E "problems"` → Expected: testler yeşil, 0 hata. `routes.test.ts` yeni rotaları bulur.

- [ ] **Step 6: Commit**

```bash
git add mobile
git commit -m "feat(mobile): vitrin/acil etiketleri, Keşfet vitrin şeridi, Öne çıkar ekranı, yönetim siparişler/fiyatlar"
```

---

### Task 11: Web iskeleti — Next.js, dil yönlendirmesi, tasarım, güvenlik başlıkları

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/vitest.config.ts`, `web/.env.example`, `web/.gitignore`
- Create: `web/src/proxy.ts` (Next 16'da ara katman dosyası; kurulumda `node_modules/next/dist/docs` içinden adını ve imzasını doğrula — 15'te `middleware.ts`)
- Create: `web/src/i18n/{tr,en}.json`, `web/src/i18n/index.ts`
- Create: `web/src/lib/security.ts`, `web/src/lib/api.ts`, `web/src/lib/format.ts`
- Create: `web/src/app/[locale]/layout.tsx`, `web/src/app/[locale]/page.tsx` (geçici "yapım aşamasında" gövdesi Task 13'te dolar), `web/src/app/globals.css`, `web/src/components/{Header,Footer}.tsx`
- Modify: kök `package.json` workspaces'a `web`, `test` betiğine `npm test -w web`
- Test: `web/__tests__/i18n.test.ts`, `web/__tests__/security.test.ts`, `web/__tests__/noHardcoded.test.ts`

**Interfaces:**
- Produces:
  - `i18n/index.ts`: `type Locale = 'tr' | 'en'`, `LOCALES`, `t(locale, key, params?) → string` (eksik anahtar geliştirmede hata, üretimde anahtarın kendisi), `localePath(locale, path) → string` (`tr` öneksiz, `en` → `/en` + path), `altPath(path)`.
  - `lib/security.ts`: `securityHeaders(nonce: string, isProd: boolean): Record<string,string>` (CSP `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: <API_ORIGIN>; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, canlıda `Strict-Transport-Security: max-age=63072000; includeSubDomains`), `sameOrigin(req: Request): boolean`.
  - `lib/api.ts` (yalnızca sunucu): `apiGet<T>(path, opts?: { token?: string; ip?: string; revalidate?: number | false }) → Promise<T>`, `apiSend<T>(method, path, body?, opts?)`; `API_URL` = `process.env.API_URL ?? 'http://127.0.0.1:3000'`; hata: `ApiError { status, code, messageKey }`; 5 sn zaman aşımı; `X-Forwarded-For: ip`.
  - `lib/format.ts`: `formatPrice(amount, currency, locale)` (`@tms/shared` yeniden), `listingSlug(l: { brand, model, year, id }) → string` (`beneteau-oceanis-38-2017-<id>`, Türkçe karakter sadeleşir), `idFromSlug(slug) → string`, `mediaUrl(fileId, w: 400|800|1600) → string` (`/media/<id>?w=<w>` — site aynı alanda `/media`'yı API'ye yeniden yazar).

- [ ] **Step 1: Paket ve yapılandırma**

```json
// web/package.json
{
  "name": "@tms/web",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "test": "vitest run",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tms/shared": "*",
    "next": "16.3.6",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^26",
    "typescript": "~5.9.3",
    "vitest": "^5.0.2"
  }
}
```

```ts
// web/next.config.ts
import type { NextConfig } from 'next';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@tms/shared'],
  // Görseller API'den; sitenin kendi görsel iyileştiricisi kullanılmaz (bellek) — API WebP genişlikleri üretir.
  images: { unoptimized: true },
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${API}/media/:path*` }];
  },
};
export default config;
```

```ts
// web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', include: ['__tests__/**/*.test.{ts,tsx}'] },
});
```
`tsconfig.json`: Next'in standart ayarı + `"paths": { "@/*": ["./src/*"] }`, `"strict": true`. `.gitignore`: `.next/`, `.env.local`, `next-env.d.ts`. `.env.example`: `API_URL=http://127.0.0.1:3000`, `NEXT_PUBLIC_SITE_URL=http://localhost:3001`, `NEXT_PUBLIC_APP_SCHEME=teknemisatiyorum`.

Run: kök `package.json` workspaces → `["shared", "api", "mobile", "web"]`; `npm install`; `cd web && npx next --version` → Expected: `16.3.6`. Ardından `ls node_modules/next/dist/docs 2>/dev/null || ls ../node_modules/next/dist/docs` ile sürüm belgelerini bul; ara katman dosyasının adını (`proxy.ts` / `middleware.ts`), `params`'ın Promise olduğunu ve `cookies()`'in async olduğunu oradan doğrula ve ledger'a `Task 11: Ruling:` olarak yaz.

- [ ] **Step 2: Başarısız testler**

```ts
// web/__tests__/i18n.test.ts
import { describe, expect, test } from 'vitest';
import tr from '../src/i18n/tr.json';
import en from '../src/i18n/en.json';
import { localePath, t } from '../src/i18n';

const flat = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));

describe('çeviriler', () => {
  test('iki dil aynı anahtarlara sahip', () => expect(flat(en).sort()).toEqual(flat(tr).sort()));
  test('parametre ve dil yolu', () => {
    expect(t('tr', 'home.title')).toBeTruthy();
    expect(localePath('tr', '/ilanlar')).toBe('/ilanlar');
    expect(localePath('en', '/ilanlar')).toBe('/en/ilanlar');
    expect(localePath('en', '/')).toBe('/en');
  });
});
```

```ts
// web/__tests__/security.test.ts
import { expect, test } from 'vitest';
import { sameOrigin, securityHeaders } from '../src/lib/security';

test('güvenlik başlıkları', () => {
  const h = securityHeaders('abc123', true);
  expect(h['Content-Security-Policy']).toContain("script-src 'self' 'nonce-abc123'");
  expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(h['Strict-Transport-Security']).toContain('max-age=');
  expect(securityHeaders('x', false)['Strict-Transport-Security']).toBeUndefined();
  expect(h['X-Content-Type-Options']).toBe('nosniff');
});

test('Origin denetimi', () => {
  const req = (origin: string | null, host = 'localhost:3001') => new Request('http://localhost:3001/api/x', { method: 'POST', headers: { host, ...(origin ? { origin } : {}) } });
  expect(sameOrigin(req('http://localhost:3001'))).toBe(true);
  expect(sameOrigin(req('https://kotu.site'))).toBe(false);
  expect(sameOrigin(req(null))).toBe(false);
});
```

```ts
// web/__tests__/noHardcoded.test.ts — mobildeki kuralın aynısı: bileşenlerde Türkçe metin JSX'e gömülmez.
import fs from 'fs';
import path from 'path';
import { expect, test } from 'vitest';

const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : /\.tsx$/.test(e.name) ? [path.join(d, e.name)] : []));
test('JSX içinde Türkçe karakterli sabit metin yok', () => {
  const bad = files(path.join(__dirname, '../src')).filter((f) => />[^<{}]*[çğıöşüÇĞİÖŞÜ][^<{}]*</.test(fs.readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
```

Run: `cd web && npx vitest run` → Expected: FAIL (modüller yok).

- [ ] **Step 3: Uygulama**

```ts
// web/src/i18n/index.ts
import tr from './tr.json';
import en from './en.json';

export type Locale = 'tr' | 'en';
export const LOCALES: Locale[] = ['tr', 'en'];
const dicts: Record<Locale, unknown> = { tr, en };

/** Anahtar → metin; `{{ad}}` parametreleri doldurulur. Eksik anahtar geliştirmede hata. */
export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dicts[locale]);
  if (typeof v !== 'string') {
    if (process.env.NODE_ENV !== 'production') throw new Error(`Çeviri yok: ${locale}.${key}`);
    return key;
  }
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
}

/** TR öneksiz, EN `/en` önekli. */
export const localePath = (locale: Locale, p: string) => (locale === 'tr' ? p : p === '/' ? '/en' : `/en${p}`);
```

`tr.json` / `en.json` başlangıç: `site.name`, `site.tagline`, `nav.listings`, `nav.expertise`, `nav.broker`, `nav.logbook`, `nav.usta`, `nav.kaptan`, `nav.login`, `nav.account`, `footer.*`, `home.title`, `home.searchPlaceholder`, `home.showcase`, `home.urgent`, `home.latest`, `home.cities`, `home.appCta`, `common.*` (Task 12-15 ekler).

```ts
// web/src/lib/security.ts
const API_ORIGIN = new URL(process.env.API_URL ?? 'http://127.0.0.1:3000').origin;

export function securityHeaders(nonce: string, isProd: boolean): Record<string, string> {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${API_ORIGIN}`,
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(isProd ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
  };
}

/** Durum değiştiren isteklerde: Origin başlığı var ve sitenin kendi adresi. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
```

`proxy.ts` (ara katman): her istekte nonce üret (`crypto.randomUUID()` base64), `x-nonce` istek başlığına koy, `securityHeaders` yanıta; yol `/en` ile başlamıyorsa isteği `/tr/...`'ye **yeniden yaz** (URL değişmez); `/tr/...` doğrudan gelirse `/...`'ye 301. `matcher`: `/((?!_next|media|favicon.ico|robots.txt|sitemap.xml|api).*)`. Girişli yolların yenilemesi Task 15'te buraya eklenir.

```ts
// web/src/lib/format.ts
import { formatPrice as fp, type Currency } from '@tms/shared';
import type { Locale } from '@/i18n';

export const formatPrice = (amount: number, currency: Currency, locale: Locale) => fp(amount, currency, locale);

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i' };
const slugPart = (s: string) => s.replace(/[çğıöşüİ]/gi, (c) => TR[c.toLowerCase()] ?? TR[c] ?? c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** `marka-model-yil-<id>`; id sonda (cuid tire içermez). */
export const listingSlug = (l: { brand: string; model: string; year: number; id: string }) => `${slugPart(`${l.brand} ${l.model}`)}-${l.year}-${l.id}`;
export const idFromSlug = (slug: string) => slug.slice(slug.lastIndexOf('-') + 1);
export const mediaUrl = (fileId: string, w: 400 | 800 | 1600) => `/media/${fileId}?w=${w}`;
```
Ek test (`web/__tests__/format.test.ts`): `listingSlug({brand:'Bavaria', model:'Cruiser 46 Çift', year:2014, id:'ck1'})` → `'bavaria-cruiser-46-cift-2014-ck1'`; `idFromSlug` geri verir.

`lib/api.ts`:

```ts
import 'server-only';

export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';
export class ApiError extends Error {
  constructor(public status: number, public code: string, public messageKey: string) { super(code); }
}
type Opts = { token?: string; ip?: string; revalidate?: number | false };

async function call<T>(method: string, path: string, body: unknown, o: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.ip) headers['X-Forwarded-For'] = o.ip;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      ...(method === 'GET' && !o.token ? { next: { revalidate: o.revalidate ?? 60 } } : { cache: 'no-store' }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'errors.network');
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.code ?? `HTTP_${res.status}`, json.messageKey ?? 'errors.generic');
  return json as T;
}
export const apiGet = <T,>(path: string, o?: Opts) => call<T>('GET', path, undefined, o);
export const apiSend = <T,>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, o?: Opts) => call<T>(method, path, body, o);
```
(`server-only` paketi devDependency değil dependency: `"server-only": "^0.0.1"`.)

`app/[locale]/layout.tsx`: `<html lang={locale}>`, `globals.css` içine `cssVariables()` çıktısı `app/layout` sunucu bileşeninde `<style nonce>` ile; yazı tipleri `next/font/google` Inter + Space Grotesk (`display: 'swap'`); `Header` (logo, Ilanlar, Ekspertiz, Broker, Usta, Kaptan, dil değiştirici, Giriş/Hesabım), `Footer` (popüler aramalar Task 13'te, yasal bağlantılar, uygulama indirme). `generateStaticParams` → `[{locale:'tr'},{locale:'en'}]`. `globals.css`: sıfırlama + `body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body)}` + kart/düğme/chip sınıfları (`.card{background:var(--c-card);border-radius:var(--r-card)}` vb.), mobil öncelikli (≤640px tek sütun).

- [ ] **Step 4: Doğrula**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx next build 2>&1 | tail -15` → Expected: testler PASS; build başarılı (API kapalıyken de; sayfalar API'ye build sırasında bağlanmaz — `dynamic` rotalar).

- [ ] **Step 5: Commit**

```bash
git add web package.json package-lock.json
git commit -m "feat(web): Next.js iskeleti — iki dil, tasarım dili, güvenlik başlıkları, API istemcisi"
```

---

### Task 12: Web — ana sayfa, arama, hazır arama sayfaları, ilan detayı, asistan

**Files:**
- Create: `web/src/app/[locale]/page.tsx`, `ilanlar/page.tsx`, `satilik/[tip]/page.tsx`, `satilik/[tip]/[sehir]/page.tsx`, `ilan/[slug]/page.tsx`, `asistan/page.tsx`, `not-found.tsx`
- Create: `web/src/components/{ListingCard,ListingGrid,SearchBox,Filters,Gallery,PriceBlock,PromoBadges,AppLink,Breadcrumbs,Unavailable}.tsx`
- Create: `web/src/lib/seo.ts`, `web/src/lib/queries.ts`, `web/src/lib/types.ts`
- Test: `web/__tests__/seo.test.ts`, `web/__tests__/queries.test.ts`, `web/__tests__/listingCard.test.tsx`

**Interfaces:**
- Consumes: Task 5 uçları (`/listings`, `/listings/showcase`, `/listings/sitemap`, `/listings/:id`), Task 11 `apiGet`, `t`, `localePath`, `listingSlug`, `idFromSlug`, `mediaUrl`, `formatPrice`; `@tms/shared` `parseQuery`, `queryChips`, `BOAT_TYPES`.
- Produces:
  - `lib/types.ts`: `ListingView` (API `listingView` + `promo`), `SearchResult { items; total; featuredTop }`.
  - `lib/queries.ts`: `searchParamsToQuery(sp: Record<string,string|undefined>) → { q: ParsedQuery; sort: 'new'|'asc'|'desc'; page: number; urgent: boolean }`, `queryToSearchParams(...)`, `landingQuery(tip, sehir?) → ParsedQuery`, `TYPE_SLUGS: Record<BoatType, string>` (`yelkenli`, `motoryat`, `gulet`, `katamaran`, `sisme` … `BOAT_TYPES`'tan), `citySlug(name)`, `cityFromSlug(slug, known: string[])`.
  - `lib/seo.ts`: `listingMetadata(l, locale) → Metadata` (başlık `"Satılık {marka} {model} ({yıl}) · {şehir} · {fiyat} | teknemisatıyorum"`, açıklama ilk 155 karakter, canonical, `alternates.languages` tr/en, `openGraph.images` ilk fotoğraf `mediaUrl(...,1600)` mutlak), `listingJsonLd(l, locale, siteUrl) → object` (`@type: Product`, `name`, `image[]`, `brand`, `offers: { @type: Offer, price, priceCurrency, availability: InStock|SoldOut, url, seller }`), `breadcrumbJsonLd(items)`, `organizationJsonLd(siteUrl)`, `websiteJsonLd(siteUrl)` (SearchAction → `/asistan?q={search_term_string}`), `pageMetadata({ title, description, path, locale, noindex? })`.

- [ ] **Step 1: Başarısız testler**

```ts
// web/__tests__/seo.test.ts
import { expect, test } from 'vitest';
import { listingJsonLd, listingMetadata, pageMetadata } from '../src/lib/seo';

const l = {
  id: 'ck9', brand: 'Beneteau', model: 'Oceanis 38', year: 2017, lengthM: 11.5, type: 'yelkenli', price: 150000, currency: 'EUR',
  location: 'Bodrum', description: 'Temiz, bakımlı. '.repeat(30), status: 'published', photos: [{ id: 'f1', url: '/media/f1' }],
  seller: { id: 's', name: 'Deniz', since: 2020, companyName: null }, promo: { featured: false, urgent: false }, badges: [], equipment: [],
} as never;

test('ilan başlığı, açıklaması, asıl adres ve dil karşılıkları', () => {
  const m = listingMetadata(l, 'tr', 'https://teknemisatiyorum.com');
  expect(m.title).toBe('Satılık Beneteau Oceanis 38 (2017) · Bodrum · €150.000 | teknemisatıyorum');
  expect(String(m.description).length).toBeLessThanOrEqual(160);
  expect(m.alternates?.canonical).toBe('https://teknemisatiyorum.com/ilan/beneteau-oceanis-38-2017-ck9');
  expect(m.alternates?.languages).toMatchObject({ tr: 'https://teknemisatiyorum.com/ilan/beneteau-oceanis-38-2017-ck9', en: 'https://teknemisatiyorum.com/en/ilan/beneteau-oceanis-38-2017-ck9' });
  expect(JSON.stringify(m.openGraph)).toContain('https://teknemisatiyorum.com/media/f1?w=1600');
});

test('schema.org ürün + teklif; satılmışsa SoldOut', () => {
  const j = listingJsonLd(l, 'tr', 'https://teknemisatiyorum.com') as Record<string, any>;
  expect(j['@type']).toBe('Product');
  expect(j.offers).toMatchObject({ '@type': 'Offer', price: 150000, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' });
  expect((listingJsonLd({ ...l, status: 'sold' } as never, 'tr', 'https://x') as any).offers.availability).toBe('https://schema.org/SoldOut');
});

test('kapalı sayfa noindex taşır', () => {
  expect(pageMetadata({ title: 'x', description: 'y', path: '/giris', locale: 'tr', noindex: true, siteUrl: 'https://x' }).robots).toMatchObject({ index: false });
});
```

```ts
// web/__tests__/queries.test.ts
import { expect, test } from 'vitest';
import { cityFromSlug, citySlug, landingQuery, queryToSearchParams, searchParamsToQuery } from '../src/lib/queries';

test('adres ↔ sorgu', () => {
  const s = searchParamsToQuery({ tip: 'yelkenli', sehir: 'Bodrum', minBoy: '10', maxFiyat: '200000', para: 'EUR', sira: 'asc', sayfa: '2', acil: '1', donanim: 'jenerator,klima' });
  expect(s).toEqual({ q: { equipment: ['jenerator', 'klima'], type: 'yelkenli', location: 'Bodrum', minLength: 10, maxPrice: 200000, currency: 'EUR' }, sort: 'asc', page: 2, urgent: true });
  expect(searchParamsToQuery(queryToSearchParams(s))).toEqual(s);
  expect(searchParamsToQuery({ sayfa: 'abc', tip: 'uzay-gemisi' })).toEqual({ q: { equipment: [] }, sort: 'new', page: 1, urgent: false });
});

test('şehir adresleri', () => {
  expect(citySlug('Göcek')).toBe('gocek');
  expect(cityFromSlug('gocek', ['Bodrum', 'Göcek'])).toBe('Göcek');
  expect(cityFromSlug('mars', ['Bodrum'])).toBeNull();
  expect(landingQuery('yelkenli', 'Bodrum')).toEqual({ equipment: [], type: 'yelkenli', location: 'Bodrum' });
});
```

```tsx
// web/__tests__/listingCard.test.tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ListingCard } from '../src/components/ListingCard';

test('vitrin ve acil etiketleri, doğru bağlantı', () => {
  render(<ListingCard locale="tr" listing={{ id: 'ck1', brand: 'Bavaria', model: 'C46', year: 2014, lengthM: 14, type: 'yelkenli', price: 90000, currency: 'EUR', location: 'Göcek', photos: [], badges: [], promo: { featured: true, urgent: true } } as never} />);
  expect(screen.getByText('Vitrin')).toBeTruthy();
  expect(screen.getByText('Acil')).toBeTruthy();
  expect(screen.getByRole('link').getAttribute('href')).toBe('/ilan/bavaria-c46-2014-ck1');
});
```

Run: `npx vitest run` → Expected: FAIL.

- [ ] **Step 2: `lib/queries.ts`, `lib/seo.ts`, `lib/types.ts` uygulaması**

```ts
// web/src/lib/queries.ts
import { BOAT_TYPES, parsedQuerySchema, type BoatType, type ParsedQuery } from '@tms/shared';
import { slugPart } from './format';

export type Sort = 'new' | 'asc' | 'desc';
export type SearchState = { q: ParsedQuery; sort: Sort; page: number; urgent: boolean };
type SP = Record<string, string | undefined>;

export const TYPE_SLUGS = Object.fromEntries(BOAT_TYPES.map((t) => [t, t])) as Record<BoatType, string>;
export const citySlug = slugPart;
export const cityFromSlug = (slug: string, known: string[]) => known.find((c) => citySlug(c) === slug) ?? null;
export const landingQuery = (type: string, city?: string): ParsedQuery => ({ equipment: [], type: type as BoatType, ...(city ? { location: city } : {}) });

const num = (v?: string) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Adres parametreleri → doğrulanmış sorgu. Geçersiz alan hata değil, yok sayılır. */
export function searchParamsToQuery(sp: SP): SearchState {
  const raw: Record<string, unknown> = {
    equipment: sp.donanim ? sp.donanim.split(',').filter(Boolean) : [],
    type: sp.tip, location: sp.sehir, currency: sp.para,
    minLength: num(sp.minBoy), maxLength: num(sp.maxBoy), minYear: num(sp.minYil), maxYear: num(sp.maxYil), maxPrice: num(sp.maxFiyat),
  };
  const q: Record<string, unknown> = { equipment: [] };
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    const r = parsedQuerySchema.safeParse({ equipment: [], [k]: v });
    if (r.success) q[k] = (r.data as Record<string, unknown>)[k];
  }
  const sort: Sort = sp.sira === 'asc' || sp.sira === 'desc' ? sp.sira : 'new';
  const p = Number(sp.sayfa);
  return { q: q as ParsedQuery, sort, page: Number.isInteger(p) && p >= 1 && p <= 500 ? p : 1, urgent: sp.acil === '1' };
}

export function queryToSearchParams(s: SearchState): SP {
  const q = s.q;
  const out: SP = {
    tip: q.type, sehir: q.location, para: q.currency,
    minBoy: q.minLength?.toString(), maxBoy: q.maxLength?.toString(), minYil: q.minYear?.toString(), maxYil: q.maxYear?.toString(), maxFiyat: q.maxPrice?.toString(),
    donanim: q.equipment.length ? q.equipment.join(',') : undefined,
    sira: s.sort === 'new' ? undefined : s.sort, sayfa: s.page > 1 ? String(s.page) : undefined, acil: s.urgent ? '1' : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}
```
(`format.ts`'teki `slugPart`'ı `export` yap.)

```ts
// web/src/lib/seo.ts
import type { Metadata } from 'next';
import { t, localePath, type Locale } from '@/i18n';
import { formatPrice, listingSlug } from './format';
import type { ListingView } from './types';

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
const clip = (s: string, n = 155) => { const c = s.replace(/\s+/g, ' ').trim(); return c.length <= n ? c : `${c.slice(0, c.lastIndexOf(' ', n - 1))}…`; };
const abs = (site: string, locale: Locale, p: string) => `${site}${localePath(locale, p)}`.replace(/\/$/, '') || site;
const langs = (site: string, p: string) => ({ tr: abs(site, 'tr', p), en: abs(site, 'en', p) });

export function pageMetadata(o: { title: string; description: string; path: string; locale: Locale; noindex?: boolean; siteUrl?: string; image?: string }): Metadata {
  const site = o.siteUrl ?? SITE();
  return {
    title: o.title, description: o.description,
    alternates: { canonical: abs(site, o.locale, o.path), languages: langs(site, o.path) },
    openGraph: { title: o.title, description: o.description, url: abs(site, o.locale, o.path), siteName: 'teknemisatıyorum', locale: o.locale === 'tr' ? 'tr_TR' : 'en_US', type: 'website', ...(o.image ? { images: [{ url: o.image }] } : {}) },
    twitter: { card: o.image ? 'summary_large_image' : 'summary' },
    ...(o.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function listingMetadata(l: ListingView, locale: Locale, siteUrl = SITE()): Metadata {
  const path = `/ilan/${listingSlug(l)}`;
  const title = t(locale, 'seo.listingTitle', { name: `${l.brand} ${l.model}`, year: l.year, city: l.location, price: formatPrice(l.price, l.currency, locale), site: 'teknemisatıyorum' });
  const description = clip(l.description || t(locale, 'seo.listingFallback', { name: `${l.brand} ${l.model}`, year: l.year, city: l.location, length: l.lengthM }));
  const image = l.photos[0] ? `${siteUrl}/media/${l.photos[0].id}?w=1600` : undefined;
  return pageMetadata({ title, description, path, locale, siteUrl, image });
}

export function listingJsonLd(l: ListingView, locale: Locale, siteUrl = SITE()) {
  return {
    '@context': 'https://schema.org', '@type': 'Product',
    name: `${l.brand} ${l.model} (${l.year})`, brand: { '@type': 'Brand', name: l.brand },
    image: l.photos.map((p) => `${siteUrl}/media/${p.id}?w=1600`),
    description: clip(l.description || `${l.brand} ${l.model}`, 500),
    offers: {
      '@type': 'Offer', price: l.price, priceCurrency: l.currency, url: abs(siteUrl, locale, `/ilan/${listingSlug(l)}`),
      availability: l.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition', areaServed: l.location,
      seller: l.seller.companyName ? { '@type': 'Organization', name: l.seller.companyName } : { '@type': 'Person', name: l.seller.name ?? '—' },
    },
  };
}

export const breadcrumbJsonLd = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })),
});
export const organizationJsonLd = (site = SITE()) => ({ '@context': 'https://schema.org', '@type': 'Organization', name: 'teknemisatıyorum', url: site, logo: `${site}/logo.png` });
export const websiteJsonLd = (site = SITE()) => ({
  '@context': 'https://schema.org', '@type': 'WebSite', name: 'teknemisatıyorum', url: site,
  potentialAction: { '@type': 'SearchAction', target: `${site}/asistan?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
});
```
`tr.json` → `seo.listingTitle`: `"Satılık {{name}} ({{year}}) · {{city}} · {{price}} | {{site}}"`, `seo.listingFallback`: `"{{year}} model {{name}}, {{length}} m, {{city}}. Fotoğraflar, özellikler ve fiyat."`; `en.json` → `"{{name}} ({{year}}) for sale · {{city}} · {{price}} | {{site}}"`, `"{{year}} {{name}}, {{length}} m, {{city}}. Photos, specs and price."`.

```ts
// web/src/lib/types.ts
import type { Currency } from '@tms/shared';
export type ListingView = {
  id: string; brand: string; model: string; year: number; lengthM: number; type: string; price: number; currency: Currency;
  location: string; equipment: string[]; cabins?: number; engine?: string; description: string; status: string; badges: string[];
  photos: { id: string; url: string }[]; seller: { id: string; name: string | null; since: number; companyName: string | null };
  logbook?: { count: number; latest: { title: string; date: string; kind: string }[] } | null;
  promo: { featured: boolean; urgent: boolean; featuredUntil?: string; urgentUntil?: string };
};
export type SearchResult = { items: ListingView[]; total: number; featuredTop: ListingView[] };
```

- [ ] **Step 3: Bileşenler ve sayfalar**

`ListingCard`: `<a href={localePath(locale, '/ilan/'+listingSlug(l))}>`, `<img src={mediaUrl(id,800)} srcSet="400w,800w" sizes="(max-width:640px) 100vw, 33vw" loading="lazy" width height alt>` (fotoğraf yoksa `gradients`'tan CSS degrade), başlık, `formatPrice`, boy/yıl/şehir, `PromoBadges`.
`page.tsx` (ana): `apiGet('/listings/showcase', { revalidate: 300 })` + `apiGet('/listings?sort=new', { revalidate: 300 })` (ilk 8) + `apiGet('/listings/sitemap', { revalidate: 300 })` (şehir/tip kısayolları için facets: sayısı en yüksek 8); `SearchBox` (form `GET` → `/asistan`), Vitrin, Acil, Son eklenenler, kısayollar, ekspertiz/broker tanıtım kartları, uygulama indirme; `websiteJsonLd` + `organizationJsonLd` (`<script type="application/ld+json" nonce>`). API hatası → `Unavailable` bileşeni (sayfa yine 200, başlık ve arama kutusu görünür).
`ilanlar/page.tsx`: `searchParamsToQuery(await searchParams)` → `apiGet('/listings?q=..&sort=..&page=..&urgent=1', { revalidate: 60 })`; üstte `featuredTop` ("Vitrin" başlıklı), `Filters` (tamamen `<form method="get">` — JavaScript gerektirmez), `ListingGrid`, sayfalama bağlantıları (`rel=prev/next`); `generateMetadata` → canonical yalnızca `sayfa` parametresiyle (diğer filtreler canonical'dan düşer → `/ilanlar` ya da `/ilanlar?sayfa=2`).
`satilik/[tip]/page.tsx` ve `[sehir]/page.tsx`: tip/şehir bilinmiyorsa `notFound()`; `landingQuery`; facets'ten sayı <3 → `robots: { index: false }`; başlık/açıklama i18n kalıbından; `breadcrumbJsonLd`.
`ilan/[slug]/page.tsx`: `idFromSlug` → `apiGet('/listings/'+id, { revalidate: 60 })`; 404 → API `status` yayında değilse ve 404 dönerse: `sitemap` listesinde yoksa `Unavailable` + benzer ilanlar + **410** (`import { unstable_...}` yerine: sayfa `notFound()` değil; Next'te 410 için rota işleyici gerekir — `ilan/[slug]/page.tsx` yerine yanıt kodunu belirleyebilmek için `proxy.ts`'de ön kontrol: `/ilan/<slug>` isteğinde `fetch(API/listings/<id>)` 404 ise yanıtı `/ilan-kalkti?slug=` sayfasına **status 410** ile yeniden yaz (`NextResponse.rewrite(url, { status: 410 })`). Doğru kimlik ama farklı slug → `permanentRedirect(localePath(locale, '/ilan/'+listingSlug(l)))` (308/301). Gövde: `Gallery` (ilk görsel `fetchPriority="high"`, diğerleri lazy), `PriceBlock` (fiyat + TL/EUR/USD karşılıkları `/fx` ile), özellik tablosu, rozetler, karne özeti, `AppLink` ("Satıcıya yaz", "Ekspertiz iste": `teknemisatiyorum://ilan/<id>` derin bağlantı + mağaza yedeği — mağaza adresleri henüz yok: uygulama tanıtım bölümüne `#uygulama` çapası), benzer ilanlar (`/listings?q={type,location}` ilk 4, kendisi hariç), `listingJsonLd` + `breadcrumbJsonLd`, `generateMetadata` = `listingMetadata`.
`ilan-kalkti/page.tsx`: "Bu ilan artık yayında değil" + benzer ilanlar (slug'daki marka ile arama); `robots noindex`.
`asistan/page.tsx`: `apiSend('POST','/assistant/search',{ text: q })` (`ip` ile; misafir kotası IP başına) → tam eşleşenler + "bir kriter eksik" (eksik kriter `queryChips` ile), `noindex`.
`not-found.tsx`: arama kutusu + popüler aramalar.

Tüm metinler `t(locale, ...)`; yeni anahtarları `tr.json`/`en.json`'a ekle.

- [ ] **Step 4: Doğrula**

Run: `npx vitest run && npx tsc --noEmit` → Expected: PASS. API açıkken (`npm run dev -- --no-mobile` + ayrı terminalde `cd web && npm run dev`): `curl -s localhost:3001/ | grep -c 'application/ld+json'` ≥ 1; `curl -s -o /dev/null -w "%{http_code}" localhost:3001/ilan/yanlis-slug-<gerçek id>` → 308/301; kaldırılmış ilan → 410.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): ana sayfa, arama, hazır arama sayfaları, ilan detayı (SEO, schema.org, 301/410), asistan"
```

---

### Task 13: Web — hizmet, usta/kaptan, katılım, kurumsal ve yasal sayfalar; çerez izni

**Files:**
- Create: `web/src/app/[locale]/{ekspertiz,broker,tekne-karnesi,usta,kaptan,usta-ol,kaptan-ol,hakkimizda,iletisim,kvkk,gizlilik,kullanim-kosullari,cerezler}/page.tsx`
- Create: `web/src/components/{DraftBanner,ServiceHero,Steps,CookieConsent}.tsx`, `web/src/lib/consent.ts`
- Test: `web/__tests__/consent.test.ts`, `web/__tests__/staticPages.test.ts`

**Interfaces:**
- Produces: `consent.ts` → `type Consent = { necessary: true; analytics: boolean; at: string }`, `readConsent(cookieValue?: string): Consent | null`, `serializeConsent(c): string` (çerez `tms_consent`, 180 gün); `CookieConsent` istemci bileşeni ("Yalnızca zorunlu" varsayılan vurgulu, "Kabul et", "Tercihler"); istatistik betiği bu turda **hiç** yok.
- Produces: `STATIC_PAGES: { path: string; key: string; indexable: boolean }[]` (`web/src/lib/pages.ts`) — site haritası ve testler buradan okur.

- [ ] **Step 1: Başarısız testler**

```ts
// web/__tests__/consent.test.ts
import { expect, test } from 'vitest';
import { readConsent, serializeConsent } from '../src/lib/consent';

test('izin çerezi okunur/yazılır; bozuk değer izin sayılmaz', () => {
  const c = { necessary: true as const, analytics: false, at: '2026-10-01T00:00:00.000Z' };
  expect(readConsent(serializeConsent(c))).toEqual(c);
  expect(readConsent('bozuk')).toBeNull();
  expect(readConsent(undefined)).toBeNull();
  expect(readConsent(JSON.stringify({ necessary: true, analytics: 'evet' }))).toBeNull();
});
```

```ts
// web/__tests__/staticPages.test.ts
import fs from 'fs';
import path from 'path';
import { expect, test } from 'vitest';
import { STATIC_PAGES } from '../src/lib/pages';

test('her sabit sayfanın dosyası ve iki dilde başlığı var; yasal sayfalar taslak şeridi taşır', async () => {
  const tr = (await import('../src/i18n/tr.json')).default as any;
  for (const p of STATIC_PAGES) {
    const file = path.join(__dirname, '../src/app/[locale]', p.path, 'page.tsx');
    expect(fs.existsSync(file), p.path).toBe(true);
    expect(tr.pages[p.key]?.title, p.key).toBeTruthy();
    if (['kvkk', 'gizlilik', 'kullanim-kosullari', 'cerezler'].includes(p.path.slice(1))) expect(fs.readFileSync(file, 'utf8')).toContain('<DraftBanner');
  }
});
```

Run: `npx vitest run consent staticPages` → Expected: FAIL.

- [ ] **Step 2: Uygulama**

`lib/pages.ts`:

```ts
export const STATIC_PAGES = [
  { path: '/ekspertiz', key: 'expertise', indexable: true }, { path: '/broker', key: 'broker', indexable: true },
  { path: '/tekne-karnesi', key: 'logbook', indexable: true }, { path: '/usta', key: 'usta', indexable: true },
  { path: '/kaptan', key: 'kaptan', indexable: true }, { path: '/usta-ol', key: 'ustaJoin', indexable: true },
  { path: '/kaptan-ol', key: 'kaptanJoin', indexable: true }, { path: '/hakkimizda', key: 'about', indexable: true },
  { path: '/iletisim', key: 'contact', indexable: true }, { path: '/kvkk', key: 'kvkk', indexable: true },
  { path: '/gizlilik', key: 'privacy', indexable: true }, { path: '/kullanim-kosullari', key: 'terms', indexable: true },
  { path: '/cerezler', key: 'cookies', indexable: true },
] as const;
```

`lib/consent.ts`:

```ts
export type Consent = { necessary: true; analytics: boolean; at: string };
export const CONSENT_COOKIE = 'tms_consent';
export const serializeConsent = (c: Consent) => JSON.stringify(c);
export function readConsent(v?: string): Consent | null {
  if (!v) return null;
  try {
    const o = JSON.parse(v);
    return o && o.necessary === true && typeof o.analytics === 'boolean' && typeof o.at === 'string' ? { necessary: true, analytics: o.analytics, at: o.at } : null;
  } catch { return null; }
}
```

Sayfalar: `ekspertiz` → `apiGet('/expertise/packages', { revalidate: 3600 })` paket kartları (fiyat, kapsam) + `Service` JSON-LD + "Uygulamadan randevu al" (`AppLink`); `broker` → süreç adımları (`Steps`) + "Uygulamadan başvur"; `tekne-karnesi` → karne anlatımı; `usta`/`kaptan` → kategoriler (`@tms/shared` `serviceCategory`'den), güvenli ödeme + karne avantajı, "Yakında" rozeti, uygulama bağlantısı; `usta-ol`/`kaptan-ol` → nasıl işler, gereken belgeler (vergi levhası/ustalık belgesi; kaptan: yat kaptanlığı/amatör denizci belgesi, sağlık raporu), "Uygulamada başvur" (`teknemisatiyorum://verify/professional`); `hakkimizda`, `iletisim` (e-posta adresi `pages.contact.email` çevirisinde; form yok); yasal dört sayfa: `<DraftBanner />` + mevcut uygulama metinlerinin (mobil `i18n` `legal.*`) web sürümü `web/src/i18n`'e taşınmış hâli. Her sayfa `pageMetadata` ile.
`CookieConsent`: `layout.tsx`'te, `tms_consent` yoksa altta çubuk; seçim `document.cookie` (`SameSite=Lax; Path=/; Max-Age=15552000`; canlıda `Secure`).

- [ ] **Step 3: Doğrula ve commit**

Run: `npx vitest run && npx tsc --noEmit` → Expected: PASS.

```bash
git add web
git commit -m "feat(web): hizmet, usta/kaptan, katılım, kurumsal ve yasal sayfalar; çerez izni"
```

---

### Task 14: Web — site haritası ve robots

**Files:**
- Create: `web/src/app/sitemap.ts`, `web/src/app/robots.ts`, `web/src/lib/sitemap.ts`
- Test: `web/__tests__/sitemap.test.ts`

**Interfaces:**
- Consumes: `GET /listings/sitemap`, `STATIC_PAGES`, `listingSlug`, `TYPE_SLUGS`, `citySlug`.
- Produces: `buildSitemap(data: { listings; facets }, siteUrl): MetadataRoute.Sitemap` (her girdi TR + `alternates.languages.en`; hazır arama sayfaları yalnızca `count ≥ 3`).

- [ ] **Step 1: Başarısız test**

```ts
// web/__tests__/sitemap.test.ts
import { expect, test } from 'vitest';
import { buildSitemap } from '../src/lib/sitemap';
import robots from '../src/app/robots';

test('ilanlar, açık hazır aramalar ve sabit sayfalar; kapalılar yok', () => {
  const s = buildSitemap({
    listings: [{ id: 'ck1', brand: 'Bavaria', model: 'C46', year: 2014, type: 'yelkenli', location: 'Göcek', updatedAt: '2026-09-20T00:00:00Z' }],
    facets: [{ type: 'yelkenli', location: null, count: 5 }, { type: 'yelkenli', location: 'Göcek', count: 3 }, { type: 'gulet', location: 'Bodrum', count: 2 }],
  }, 'https://teknemisatiyorum.com');
  const urls = s.map((x) => x.url);
  expect(urls).toContain('https://teknemisatiyorum.com/ilan/bavaria-c46-2014-ck1');
  expect(urls).toContain('https://teknemisatiyorum.com/satilik/yelkenli');
  expect(urls).toContain('https://teknemisatiyorum.com/satilik/yelkenli/gocek');
  expect(urls).not.toContain('https://teknemisatiyorum.com/satilik/gulet/bodrum');
  expect(urls).toContain('https://teknemisatiyorum.com/usta-ol');
  expect(urls.some((u) => u.includes('/hesabim') || u.includes('/giris') || u.includes('/asistan'))).toBe(false);
  expect(s.find((x) => x.url.endsWith('ck1'))!.alternates!.languages!.en).toBe('https://teknemisatiyorum.com/en/ilan/bavaria-c46-2014-ck1');
});

test('robots girişli alanı, ödemeyi ve asistanı kapatır', () => {
  const r = robots();
  const dis = ([] as string[]).concat((r.rules as { disallow: string[] }).disallow);
  for (const p of ['/hesabim', '/odeme', '/giris', '/asistan', '/en/hesabim', '/en/odeme', '/en/giris', '/en/asistan', '/api/']) expect(dis).toContain(p);
  expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
});
```

Run: `npx vitest run sitemap` → Expected: FAIL.

- [ ] **Step 2: Uygulama**

```ts
// web/src/lib/sitemap.ts
import type { MetadataRoute } from 'next';
import { listingSlug, citySlug } from './format';
import { STATIC_PAGES } from './pages';

type Data = { listings: { id: string; brand: string; model: string; year: number; type: string; location: string; updatedAt: string }[]; facets: { type: string; location: string | null; count: number }[] };

export function buildSitemap(d: Data, site: string): MetadataRoute.Sitemap {
  const entry = (p: string, lastModified?: string, priority = 0.5): MetadataRoute.Sitemap[number] => ({
    url: `${site}${p === '/' ? '' : p}`, lastModified, priority,
    alternates: { languages: { tr: `${site}${p === '/' ? '' : p}`, en: `${site}/en${p === '/' ? '' : p}` } },
  });
  return [
    entry('/', undefined, 1),
    entry('/ilanlar', undefined, 0.9),
    ...d.listings.map((l) => entry(`/ilan/${listingSlug(l)}`, l.updatedAt, 0.8)),
    ...d.facets.filter((f) => f.count >= 3).map((f) => entry(f.location ? `/satilik/${f.type}/${citySlug(f.location)}` : `/satilik/${f.type}`, undefined, 0.7)),
    ...STATIC_PAGES.filter((p) => p.indexable).map((p) => entry(p.path, undefined, 0.4)),
  ];
}
```

```ts
// web/src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api';
import { buildSitemap } from '@/lib/sitemap';

export const revalidate = 600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  const data = await apiGet<Parameters<typeof buildSitemap>[0]>('/listings/sitemap', { revalidate: 600 }).catch(() => ({ listings: [], facets: [] }));
  return buildSitemap(data, site);
}
```

```ts
// web/src/app/robots.ts
import type { MetadataRoute } from 'next';

const CLOSED = ['/hesabim', '/odeme', '/giris', '/asistan', '/ilan-kalkti'];
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  return { rules: { userAgent: '*', allow: '/', disallow: [...CLOSED, ...CLOSED.map((p) => `/en${p}`), '/api/'] }, sitemap: `${site}/sitemap.xml` };
}
```

- [ ] **Step 3: Doğrula ve commit**

Run: `npx vitest run` → PASS.

```bash
git add web
git commit -m "feat(web): site haritası ve robots"
```

---

### Task 15: Web — giriş (BFF), Hesabım, İlanlarım, Öne çıkar, ödeme

**Files:**
- Create: `web/src/lib/session.ts`, `web/src/app/api/auth/{otp,verify,logout}/route.ts`, `web/src/app/api/orders/route.ts`, `web/src/app/api/odeme/deneme/route.ts`
- Create: `web/src/app/[locale]/giris/page.tsx`, `hesabim/page.tsx`, `hesabim/ilanlar/page.tsx`, `hesabim/ilanlar/[id]/one-cikar/page.tsx`, `hesabim/siparisler/page.tsx`, `odeme/deneme/page.tsx`, `odeme/sonuc/page.tsx`
- Create: `web/src/components/{LoginForm,BuyButton,DevPayButtons}.tsx` (istemci)
- Modify: `web/src/proxy.ts` (girişli yollar: anahtar yenileme / yönlendirme)
- Test: `web/__tests__/session.test.ts`, `web/__tests__/authRoutes.test.ts`, `web/__tests__/proxyAuth.test.ts`

**Interfaces:**
- Consumes: API `/auth/otp|verify|refresh|logout`, `/me`, `/me/listings`, `/products`, `/orders`, `/orders/:id`, `/me/orders`, `/payments/web/dev-complete`; Task 11 `apiSend`, `sameOrigin`.
- Produces:
  - `session.ts`: `ACCESS_COOKIE='tms_at'`, `REFRESH_COOKIE='tms_rt'`, `cookieOptions(maxAgeS: number, isProd: boolean)` → `{ httpOnly: true, sameSite: 'lax', path: '/', secure: isProd, maxAge }`, `jwtExpired(token: string, now = Date.now(), skewS = 30): boolean` (imzasız okuma — yalnızca "yenilemeli mi" kararı; doğrulamayı API yapar), `clientIp(req): string` (`x-forwarded-for` ilk halka yoksa `x-real-ip` yoksa `''`), `setSession(res, tokens, isProd)`, `clearSession(res)`.
  - Rota işleyicileri: `POST /api/auth/otp` `{ phone }` → API; `POST /api/auth/verify` `{ phone, code }` → API (`deviceName: 'Web'`) → çerezler; `POST /api/auth/logout`; `POST /api/orders` `{ listingId, productCode }` → API `/orders` → `{ checkoutUrl }`; `POST /api/odeme/deneme` `{ orderId, result }` → API `/payments/web/dev-complete`. Hepsinde `sameOrigin` yoksa 403 `{ code: 'FORBIDDEN_ORIGIN' }`; API hatası → aynı `{ code, messageKey }` ve durum.
  - `proxy.ts`: `/hesabim`, `/odeme` (ve `/en/...`) için: `tms_at` yok/`jwtExpired` ve `tms_rt` var → API `/auth/refresh` → yeni çerezler yanıtta; yenileme reddedilir ya da `tms_rt` yok → `/giris?next=<yol>` (ve çerezler silinir).

- [ ] **Step 1: Başarısız testler**

```ts
// web/__tests__/session.test.ts
import { expect, test } from 'vitest';
import { clientIp, cookieOptions, jwtExpired } from '../src/lib/session';

const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ sub: 'u', exp })).toString('base64url')}.y`;

test('süre kontrolü (30 sn pay) ve bozuk anahtar', () => {
  const now = 1_800_000_000_000;
  expect(jwtExpired(jwt(now / 1000 + 600), now)).toBe(false);
  expect(jwtExpired(jwt(now / 1000 + 10), now)).toBe(true);
  expect(jwtExpired('bozuk', now)).toBe(true);
});

test('çerez bayrakları', () => {
  expect(cookieOptions(900, true)).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 900 });
  expect(cookieOptions(900, false).secure).toBe(false);
});

test('ziyaretçi IP adresi', () => {
  expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }))).toBe('9.9.9.9');
  expect(clientIp(new Request('http://x'))).toBe('');
});
```

```ts
// web/__tests__/authRoutes.test.ts
import { afterEach, expect, test, vi } from 'vitest';
import { POST as verify } from '../src/app/api/auth/verify/route';
import { POST as orders } from '../src/app/api/orders/route';

afterEach(() => vi.restoreAllMocks());
const req = (url: string, body: unknown, origin: string | null = 'http://localhost:3001', cookie = '') =>
  new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', host: 'localhost:3001', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) } });

test('giriş: anahtarlar yanıt gövdesinde değil HttpOnly çerezde', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ accessToken: 'A'.repeat(30), refreshToken: 'R'.repeat(40), user: { id: 'u', name: 'X' } }), { status: 200 }));
  const res = await verify(req('http://localhost:3001/api/auth/verify', { phone: '05321112233', code: '123456' }));
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).not.toContain('AAAA');
  expect(body).not.toContain('RRRR');
  const cookies = res.headers.getSetCookie().join('\n');
  expect(cookies).toMatch(/tms_at=A+;.*HttpOnly/i);
  expect(cookies).toMatch(/tms_rt=R+;.*HttpOnly/i);
  expect(cookies).toMatch(/SameSite=lax/i);
});

test('başka siteden gelen istek reddedilir (Origin)', async () => {
  const f = vi.spyOn(globalThis, 'fetch');
  expect((await verify(req('http://localhost:3001/api/auth/verify', { phone: '1', code: '1' }, 'https://kotu.site'))).status).toBe(403);
  expect((await orders(req('http://localhost:3001/api/orders', { listingId: 'l', productCode: 'vitrin_7' }, null, 'tms_at=x'))).status).toBe(403);
  expect(f).not.toHaveBeenCalled();
});

test('sunucu hatası aynı kod ve durumla iletilir', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'OTP_INVALID', messageKey: 'errors.otp_invalid' }), { status: 400 }));
  const res = await verify(req('http://localhost:3001/api/auth/verify', { phone: '05321112233', code: '000000' }));
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ code: 'OTP_INVALID', messageKey: 'errors.otp_invalid' });
});
```

```ts
// web/__tests__/proxyAuth.test.ts
import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

afterEach(() => vi.restoreAllMocks());
const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
const req = (path: string, cookie = '') => new NextRequest(`http://localhost:3001${path}`, { headers: { cookie, host: 'localhost:3001' } });

test('süresi dolmuş erişim anahtarı sessizce yenilenir', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ accessToken: jwt(Date.now() / 1000 + 900), refreshToken: 'N'.repeat(40) }), { status: 200 }));
  const res = await proxy(req('/hesabim', `tms_at=${jwt(Date.now() / 1000 - 5)}; tms_rt=${'R'.repeat(40)}`));
  expect(res.headers.get('location')).toBeNull();
  expect(res.headers.getSetCookie().join('\n')).toMatch(/tms_rt=N+/);
});

test('yenileme reddedilirse girişe yönlendirilir ve çerezler silinir', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
  const res = await proxy(req('/en/hesabim/ilanlar', `tms_rt=${'R'.repeat(40)}`));
  expect(res.headers.get('location')).toBe('http://localhost:3001/en/giris?next=%2Fen%2Fhesabim%2Filanlar');
  expect(res.headers.getSetCookie().join('\n')).toMatch(/tms_rt=;/);
});

test('çerezsiz ziyaretçi girişe; herkese açık sayfa etkilenmez', async () => {
  const f = vi.spyOn(globalThis, 'fetch');
  expect((await proxy(req('/odeme/deneme?order=o1'))).headers.get('location')).toBe('http://localhost:3001/giris?next=%2Fodeme%2Fdeneme%3Forder%3Do1');
  expect((await proxy(req('/ilanlar'))).headers.get('location')).toBeNull();
  expect(f).not.toHaveBeenCalled();
});
```

Run: `npx vitest run session authRoutes proxyAuth` → Expected: FAIL.

- [ ] **Step 2: `session.ts`**

```ts
// web/src/lib/session.ts
export const ACCESS_COOKIE = 'tms_at';
export const REFRESH_COOKIE = 'tms_rt';
export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 3600;
export const isProd = () => process.env.NODE_ENV === 'production';

export const cookieOptions = (maxAge: number, prod: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, path: '/', secure: prod, maxAge });

/** Yalnızca "yenilemeli mi" kararı için imzasız okuma; anahtarı doğrulayan API'dir. */
export function jwtExpired(token: string, now = Date.now(), skewS = 30): boolean {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof exp !== 'number' || exp * 1000 - skewS * 1000 <= now;
  } catch { return true; }
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
}

type Cookieable = { cookies: { set(name: string, value: string, o: ReturnType<typeof cookieOptions>): unknown } };
export function setSession(res: Cookieable, t: { accessToken: string; refreshToken: string }) {
  res.cookies.set(ACCESS_COOKIE, t.accessToken, cookieOptions(ACCESS_MAX_AGE, isProd()));
  res.cookies.set(REFRESH_COOKIE, t.refreshToken, cookieOptions(REFRESH_MAX_AGE, isProd()));
}
export function clearSession(res: Cookieable) {
  res.cookies.set(ACCESS_COOKIE, '', cookieOptions(0, isProd()));
  res.cookies.set(REFRESH_COOKIE, '', cookieOptions(0, isProd()));
}
```

- [ ] **Step 3: Rota işleyicileri**

```ts
// web/src/app/api/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { sameOrigin } from '@/lib/security';
import { clientIp, setSession } from '@/lib/session';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ code: 'FORBIDDEN_ORIGIN', messageKey: 'errors.forbidden' }, { status: 403 });
  const { phone, code } = await req.json().catch(() => ({}));
  const r = await fetch(`${API_URL}/auth/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp(req) },
    body: JSON.stringify({ phone, code, deviceName: 'Web' }), signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!r) return NextResponse.json({ code: 'NETWORK', messageKey: 'errors.network' }, { status: 502 });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ code: body.code, messageKey: body.messageKey }, { status: r.status });
  const res = NextResponse.json({ ok: true, user: { name: body.user?.name ?? null } });
  setSession(res, body);
  return res;
}
```
Ortak yardımcı (dört rota bunu kullanır):

```ts
// web/src/lib/bff.ts
import { NextResponse } from 'next/server';
import { API_URL } from './api';
import { sameOrigin } from './security';
import { ACCESS_COOKIE, clientIp } from './session';

export const forbidden = () => NextResponse.json({ code: 'FORBIDDEN_ORIGIN', messageKey: 'errors.forbidden' }, { status: 403 });

/** Tarayıcı isteğini API'ye aktarır: Origin denetimi, ziyaretçi IP'si, isteğe bağlı oturum anahtarı. */
export async function relay(req: Request, path: string, body: unknown, o: { auth?: boolean } = {}) {
  if (!sameOrigin(req)) return { res: forbidden() } as const;
  const token = o.auth ? cookieValue(req, ACCESS_COOKIE) : undefined;
  if (o.auth && !token) return { res: NextResponse.json({ code: 'UNAUTHENTICATED', messageKey: 'errors.unauthenticated' }, { status: 401 }) } as const;
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp(req), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!r) return { res: NextResponse.json({ code: 'NETWORK', messageKey: 'errors.network' }, { status: 502 }) } as const;
  const json = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) return { res: NextResponse.json({ code: json.code, messageKey: json.messageKey }, { status: r.status }) } as const;
  return { ok: json } as const;
}

export function cookieValue(req: Request, name: string) {
  const m = (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) || undefined : undefined;
}
```

```ts
// web/src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { relay } from '@/lib/bff';

export async function POST(req: Request) {
  const { listingId, productCode } = await req.clone().json().catch(() => ({}));
  const r = await relay(req, '/orders', { listingId, productCode }, { auth: true });
  if ('res' in r) return r.res;
  return NextResponse.json({ checkoutUrl: r.ok.checkoutUrl, orderId: r.ok.orderId });
}
```

```ts
// web/src/app/api/auth/otp/route.ts
import { NextResponse } from 'next/server';
import { relay } from '@/lib/bff';

export async function POST(req: Request) {
  const { phone } = await req.clone().json().catch(() => ({}));
  const r = await relay(req, '/auth/otp', { phone });
  if ('res' in r) return r.res;
  // Kapalı betada API kodu yalnızca geliştirmede ve ekip dışı numaraya döndürür; aynen iletilir.
  return NextResponse.json(r.ok?.devCode ? { devCode: r.ok.devCode } : {});
}
```

```ts
// web/src/app/api/odeme/deneme/route.ts
import { NextResponse } from 'next/server';
import { relay } from '@/lib/bff';

export async function POST(req: Request) {
  const { orderId, result } = await req.clone().json().catch(() => ({}));
  const r = await relay(req, '/payments/web/dev-complete', { orderId, result }, { auth: true });
  return 'res' in r ? r.res : NextResponse.json({ ok: true });
}
```

```ts
// web/src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { relay } from '@/lib/bff';
import { clearSession } from '@/lib/session';

export async function POST(req: Request) {
  const r = await relay(req, '/auth/logout', undefined, { auth: true });
  if ('res' in r && r.res.status === 403) return r.res;
  const res = NextResponse.json({ ok: true });
  clearSession(res); // API hatası olsa da tarayıcıdaki oturum kapanır
  return res;
}
```
`verify/route.ts` de `relay` kullanacak biçimde yazılabilir; yukarıdaki açık hâli çerez yazımı nedeniyle korunur.

- [ ] **Step 4: `proxy.ts` girişli yollar**

Mevcut dil/başlık mantığına ek, `export async function proxy(req: NextRequest)` içinde (dışa aktarılan ad Step 1 Task 11'de doğrulanan ada göre):

```ts
const PRIVATE = /^\/(en\/)?(hesabim|odeme)(\/|$)/;

  if (PRIVATE.test(req.nextUrl.pathname)) {
    const at = req.cookies.get(ACCESS_COOKIE)?.value;
    const rt = req.cookies.get(REFRESH_COOKIE)?.value;
    const toLogin = () => {
      const en = req.nextUrl.pathname.startsWith('/en/');
      const url = new URL(`${en ? '/en' : ''}/giris`, req.url);
      url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
      const r = NextResponse.redirect(url);
      clearSession(r);
      return r;
    };
    if (!at || jwtExpired(at)) {
      if (!rt) return toLogin();
      const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }), signal: AbortSignal.timeout(5000) }).catch(() => null);
      if (!r?.ok) return toLogin();
      const tokens = await r.json();
      const res = /* dil yeniden yazımı + güvenlik başlıklarıyla oluşturulan yanıt */ next(req);
      setSession(res, tokens);
      // Aynı istekte sayfa yeni anahtarı görsün:
      res.headers.set('x-tms-at', tokens.accessToken);
      return res;
    }
  }
```
Sunucu bileşenleri anahtarı `headers().get('x-tms-at') ?? (await cookies()).get('tms_at')?.value` ile okur (`lib/session.ts`'e `currentToken()` yardımcısı).

- [ ] **Step 5: Sayfalar**

- `giris/page.tsx` + `LoginForm` (istemci): telefon → `/api/auth/otp` → kod (dönen `devCode` varsa doldurulur; mobildeki gibi adres çubuğuna yazılmaz) → `/api/auth/verify` → `next` parametresi yalnızca `/` ile başlayan ve `//` ile başlamayan yollar (açık yönlendirme yok), yoksa `/hesabim`. Hatalar `t(locale, messageKey)`. "Tekrar gönder" 60 sn.
- `hesabim/page.tsx`: `apiGet('/me', { token })` → ad, seviye; bağlantılar; "Çıkış" (form → `/api/auth/logout`).
- `hesabim/ilanlar/page.tsx`: `/me/listings` → her ilan: durum, `promo` kalan günler, yayındaysa "Öne çıkar" bağlantısı; yayında değilse neden (`t('account.notPublished')`).
- `hesabim/ilanlar/[id]/one-cikar/page.tsx`: `/products` → site fiyatı (`priceWebKurus`), `isTrialPrice` notu; `BuyButton` (istemci) → `/api/orders` → `window.location.assign(checkoutUrl)` (yalnızca kendi alan adı ya da sağlayıcı alan adı: `new URL(checkoutUrl).origin` ∈ {site, `NEXT_PUBLIC_PAYMENT_ORIGIN`}).
- `odeme/deneme/page.tsx`: `?order=` → `/orders/:id` (token; başkasınınki 404 → `notFound()`); tutar, ürün, ilan; `DevPayButtons` → `/api/odeme/deneme` → `/odeme/sonuc?order=`. Sayfada "DENEME ÖDEMESİ — gerçek para çekilmez" şeridi.
- `odeme/sonuc/page.tsx`: `/orders/:id` durumu: `paid` → başarı + "İlanı gör"; `pending` → "Ödeme onayı bekleniyor" + 3 sn'de bir yenileme (`<meta http-equiv="refresh" content="3">`, en fazla 20 kez `?n=` sayacıyla); `failed`/`cancelled` → "Tekrar dene".
- `hesabim/siparisler/page.tsx`: `/me/orders` tablo.
- Hepsi `robots: { index: false }`.

- [ ] **Step 6: Doğrula ve commit**

Run: `npx vitest run && npx tsc --noEmit && npx next build 2>&1 | tail -5` → Expected: PASS, build başarılı.

```bash
git add web
git commit -m "feat(web): sitede giriş (HttpOnly çerez), Hesabım, İlanlarım, Öne çıkar ve deneme ödemesi"
```

---

### Task 16: Geliştirme komutu, uçtan uca kabul, hız ölçümü

**Files:**
- Modify: `scripts/dev.mjs` (`--web`, `--no-mobile`), `api/.env` üretiminde `CORS_ORIGINS`'e `http://localhost:3001`
- Create: `web/scripts/web-acceptance.mjs`, `docs/web-kabul.md` (betik üretir), `docs/web-shots/*.jpg`
- Modify: `README.md` (web komutları), `docs/YAPILACAKLAR.md` (biten satırlar), `docs/HANDOFF.md`

**Interfaces:** Consumes: tüm önceki görevler. Produces: `npm run dev -- --web [--no-mobile] [--tunnel]`; `node web/scripts/web-acceptance.mjs` (API 3000, web 3001, Metro 8081 açıkken; `DEV_LOG` yönetici kodu için).

- [ ] **Step 1: dev.mjs**

```js
const withWeb = process.argv.includes('--web');
const noMobile = process.argv.includes('--no-mobile');
// ... API başladıktan sonra:
if (withWeb) start('Web', 'npm', ['run', 'dev'], { cwd: path.join(ROOT, 'web'), env: { ...process.env, API_URL: 'http://127.0.0.1:3000' } });
if (!noMobile) start('Expo', 'npx', ['expo', 'start', ...(tunnel ? ['--tunnel'] : [])], { cwd: MOBILE, env: { ...process.env, EXPO_PUBLIC_API_PROXY: '1' } });
```
Başlık yorumuna kullanım satırlarını ekle. Mevcut `.env`'de `CORS_ORIGINS` 3001'i içermiyorsa ekleyen blok (Task 4 Step 2 deseni).

- [ ] **Step 2: Kabul betiği**

`web/scripts/web-acceptance.mjs` (`mobile/scripts/beta-acceptance.mjs` deseni: `playwright-core` + sistem Chrome, `criterion(n, ad, açıklama, fn)`, ekran görüntüleri `docs/web-shots/`, rapor `docs/web-kabul.md`). Kriterler spec §10 ile birebir:
1. `/` ve `/en` açılır; ana sayfada arama kutusu; `/ilanlar`, bir `/satilik/<tip>`, bir ilan detayı, `/ekspertiz`, `/usta-ol`, `/kvkk` 200 döner ve başlıkları dolu.
2. İlan detayında `<title>` kalıba uyar, `og:image` var, `application/ld+json` içinde `"@type":"Product"`; `/sitemap.xml` o ilanı içerir; kaldırılan ilan (API ile `removed` yapılır — betik yönetici anahtarıyla `DELETE /listings/:id` ya da doğrudan kabul hesabının kendi ilanı) 410 döner ve site haritasında yoktur.
3. Satıcı (yeni telefon, `randomTckn()` ile kimlik — uygulama betiğindeki yardımcı) API üzerinden ilan açar ve yönetici onaylar (API çağrıları, arayüz değil — bu kriter sitenin satın alma akışını sınar); tarayıcıda `/giris` → kod (`devCode`) → `/hesabim/ilanlar` → "Öne çıkar" → "Vitrin · 7 gün" → deneme sayfası → "Başarılı öde" → sonuç "etkin"; ana sayfada ilan "Vitrin" etiketli ve `/ilanlar` üstünde; Metro'da (`http://localhost:8081`) uygulamanın Keşfet vitrin şeridinde etiketli.
4. Uygulamada (Metro web) aynı satıcıyla giriş → İlanlarım → Öne çıkar → "Acil · 7 gün" → "Satın al (deneme)"; sitede ilan "Acil" etiketli.
5. Yönetici (uygulama, `DEV_LOG`'dan kod) → Yönetim → Siparişler: havale siparişi oluşturur (açıklama "Dekont TEST"), iade eder; Fiyatlar: `vitrin_7` site fiyatını değiştirir; Kayıtlar'da üç işlem görünür.
6. Sahte bildirim: `curl` benzeri `fetch` ile imzasız `POST /payments/web/callback` → 400; aynı deneme makbuzu iki kez `POST /orders/store` → ikincisi 409.

- [ ] **Step 3: Hız ölçümü**

Run (web üretim derlemesiyle — geliştirme sunucusu ölçüme uygun değil): `cd web && npx next build && npx next start -p 3001` (ayrı süreç) ve
`npx lighthouse http://localhost:3001/ --preset=perf --form-factor=mobile --only-categories=performance,seo,accessibility --output=json --output-path=../docs/web-shots/lh-home.json --chrome-flags="--headless=new"`; ilan detayı için aynı (`lh-listing.json`).
Expected: üç kategori ≥ 0.90. Değilse raporun "fırsatlar" listesinden en büyük üç kalemi düzelt (tipik: görsel boyutları, yazı tipi yükleme, kullanılmayan JS) ve tekrar ölç; ledger'a skorları yaz.

- [ ] **Step 4: Belgeler ve commit**

README'ye web komutları; `docs/HANDOFF.md`'ye web bölümü; `docs/YAPILACAKLAR.md`'de bu turda bitenleri sil, yeni ertelenenleri ekle (Aşama 2 ödeme zaten var).

```bash
git add scripts/dev.mjs web/scripts docs README.md
git commit -m "test: web kabul testi (6 kriter), hız ölçümü; geliştirme komutuna --web / --no-mobile"
```

---

## Son adımlar (executing-plans gereği)

- Tüm takımlar: `npm test -w shared && npm test -w api && npm test -w mobile && npm test -w web`; `cd mobile && npx expo lint`; `cd web && npx tsc --noEmit`.
- Bağımsız inceleme (en yetenekli model), Review Focus listesi verbatim.
- `docs/YAPILACAKLAR.md` üzerinden kullanıcıya hatırlatma.
