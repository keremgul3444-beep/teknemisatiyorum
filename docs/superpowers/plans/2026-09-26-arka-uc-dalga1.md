# Arka Uç 1. Dalga (Kapalı Beta) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prototipin sahte veri katmanını NestJS + PostgreSQL arka ucuyla değiştirip uygulamayı kalıcı veriyle çalışan kapalı betaya çevirmek.

**Architecture:** npm workspaces ile üç paket: `shared` (zod şemaları, asistan ayrıştırıcısı, kur yardımcıları), `api` (NestJS modüler tek sunucu, Prisma, gömülü PostgreSQL), `mobile` (mevcut Expo; servis katmanına `api` uygulaması eklenir, `mock` korunur). Dış servisler tek arayüzlü takma yuvaların arkasında; Claude API gerçek.

**Tech Stack:** Node 25 · TypeScript · NestJS 11 · Prisma 6 · PostgreSQL 16 (`embedded-postgres`) · zod · @nestjs/throttler · @nestjs/jwt · sharp · @anthropic-ai/sdk · jest + supertest · Expo SDK 57 · @tanstack/react-query · expo-secure-store.

**Spec:** `docs/superpowers/specs/2026-09-26-arka-uc-dalga1-design.md`

## Global Constraints

- Kök: `C:\AI_WORKSPACE\teknemisatiyorum`; paketler `shared/`, `api/`, `mobile/`; kök `package.json` npm workspaces.
- Sürümler kurulum anında `npm view <paket> version` ile doğrulanır; Expo paketleri her zaman `npx expo install` ile.
- Anthropic SDK kodu yazılmadan önce `claude-api` skill'i okunur; model: `claude-haiku-4-5-20251001` (ayar: `LLM_MODEL`).
- Gizli değerler yalnızca `api/.env` (git dışı): `JWT_SECRET`, `ID_ENC_KEY` (32 bayt base64), `ANTHROPIC_API_KEY`, `DATABASE_URL`. `api/.env.example` depoda.
- Hata biçimi her yerde `{ code, messageKey, params? }`; `messageKey` tr/en çevirisi mobile i18n'de bulunur.
- Uç nokta varsayılanı **kapalı**: her controller `@Public()` ya da `@Auth(level?, roles?)` bildirimi taşır.
- İşlem kaydı yalnızca ekleme; `audit_log` üzerinde update/delete kodu yazılmaz.
- OTP 5 dk / 5 deneme / numara başına 1 kod/dk / IP başına 10 kod/saat. JWT 15 dk, yenileme 30 gün, rotation + tekrar kullanımda zincir iptali.
- Asistan: Claude'a yalnızca metin; 4 sn zaman aşımı; önbellek 24 saat; kota kullanıcı 50/gün, misafir IP 20/gün; hata/kota → kural tabanlı ayrıştırıcı.
- Fotoğraf: ≤ 20/ilan, ≤ 10 MB, jpeg/png/heic → jpeg, uzun kenar ≤ 2000 px, EXIF silinir. Korumalı dosyalar yalnızca 5 dk'lık imzalı bağlantıyla.
- Commit mesajları Türkçe, sonunda oturumun atıf satırları.

## Review Focus

1. **Kimlik numarası sızıntısı** — hiçbir API yanıtında (kendi profili dahil) şifreli alan ya da tam numara dönmez; yalnızca `nationalIdLast2`. (Task 5 testi)
2. **Başkasının kaydına erişim (IDOR)** — başka kullanıcının taslak ilanı, teknesi, sohbeti, broker dosyası, korumalı dosyası id tahminiyle okunamaz/değiştirilemez → 404. (Task 5, 6, 8, 9 testleri)
3. **Yarış durumu: aynı OTP ile iki paralel doğrulama** → yalnızca biri oturum açar (atomik `consumedAt` güncellemesi). (Task 4 testi)
4. **Claude'un şema dışı ya da kötü niyetli çıktı vermesi** (fazla alan, negatif boy, SQL benzeri metin) → zod eler, arama yalnızca güvenli filtreyle yapılır. (Task 7 testi)
5. **Mobil tarafta süresi dolmuş giriş anahtarı** → istemci tek seferde yenileyip isteği tekrarlar; yenileme de başarısızsa oturum kapanır, kullanıcı girişe yönlenir, sonsuz döngü olmaz. (Task 10 testi)

---

## Dosya Yapısı

```
package.json                 # workspaces: shared, api, mobile; scripts: dev, test
shared/
  package.json  tsconfig.json
  src/index.ts
  src/filter.ts              # ParsedQuery zod şeması + tipler (Currency, BoatType, Equipment…)
  src/assistant/parse.ts match.ts chips.ts serviceCategory.ts   # prototipten taşınır
  src/rates.ts               # formatPrice, toTRY(amount, cur, rates)
  src/tckn.ts                # TCKN algoritmik doğrulama
  src/mask.ts                # maskPhone (prototipten), maskNationalId
  __tests__/…
api/
  package.json tsconfig.json nest-cli.json .env.example
  prisma/schema.prisma  prisma/seed.ts
  scripts/db.ts              # gömülü PostgreSQL başlat/durdur
  scripts/backup.ts
  src/main.ts app.module.ts
  src/config/env.ts          # zod ile ortam doğrulama
  src/common/                # errors.ts, error.filter.ts, zod.pipe.ts, auth.guard.ts, decorators.ts, prisma.service.ts, audit.service.ts
  src/adapters/              # sms.ts identity.ts storage.ts llm.ts mailer.ts
  src/modules/<modül>/       # auth users companies verification media listings assistant boats messages expertise broker admin notifications
  test/                      # e2e: setup.ts (test veritabanı), <modül>.e2e-spec.ts
mobile/
  src/services/api/          # client.ts (fetch + yenileme), hooks.ts (react-query), index.ts
  src/services/mock/         # bugünkü store.ts buraya taşınır
  src/services/index.ts      # mod seçici: DEMO_MODE ? mock : api
```

---

### Task 1: Monorepo ve `shared` paketi

**Files:**
- Create: `package.json` (kök), `shared/package.json`, `shared/tsconfig.json`, `shared/jest.config.js`, `shared/src/{index,filter,rates,tckn,mask}.ts`, `shared/src/assistant/*`
- Move: `mobile/src/features/assistant/{parse,match,chips,serviceCategory}.ts` → `shared/src/assistant/`; `mobile/src/features/mask.ts` → `shared/src/mask.ts`; ilgili testler `shared/__tests__/`
- Modify: `mobile/tsconfig.json`, `mobile/jest.config.js`, `mobile/metro.config.js` (yeni), import yolları

**Interfaces:**
- Produces: `@tms/shared` paketi. Dışa aktarımlar:
  - `ParsedQuery`, `parsedQuerySchema` (zod; `.strip()`), `Currency`, `BoatType`, `Equipment`, `UstaCategory`
  - `parseQuery(text)`, `isEmptyQuery(q)`, `failures(listing, q, rates)`, `matchListings(listings, q, rates)`, `queryChips`, `queryToText`, `detectCategory`
  - `Rates = Record<Currency, number>`, `DEMO_RATES`, `toTRY(amount, cur, rates = DEMO_RATES)`, `formatPrice`
  - `isValidTckn(s)`, `maskPhone(s)`, `maskNationalId(last2)`

- [ ] **Step 1: TCKN testi (yeni davranış)** — `shared/__tests__/tckn.test.ts`:

```ts
import { isValidTckn } from '../src/tckn';
test('geçerli numara', () => { expect(isValidTckn('10000000146')).toBe(true); });
test('0 ile başlayan geçersiz', () => { expect(isValidTckn('01234567890')).toBe(false); });
test('kontrol hanesi yanlış', () => { expect(isValidTckn('10000000147')).toBe(false); });
test('uzunluk ve rakam', () => { expect(isValidTckn('1234')).toBe(false); expect(isValidTckn('1000000014a')).toBe(false); });
```

Run: `npm test -w shared` → FAIL (modül yok)

- [ ] **Step 2: `tckn.ts`**

```ts
/** T.C. kimlik numarasının algoritmik geçerliliği (kişinin varlığını değil, numaranın biçimini doğrular). */
export function isValidTckn(s: string): boolean {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = s.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === d10 && d[10] === d11;
}
```

- [ ] **Step 3:** Asistan dosyalarını ve testlerini taşı; `@/services/types` ve `@/services/rates` importlarını `../filter` / `../rates` yap. `match.ts` ve `failures` üçüncü parametre `rates: Rates = DEMO_RATES` alır (sunucu kur tablosunu geçirir). `filter.ts`:

```ts
import { z } from 'zod';
export const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
export const BOAT_TYPES = ['motoryat', 'yelkenli', 'gulet', 'surat', 'balikci', 'katamaran'] as const;
export const EQUIPMENT = ['jenerator', 'branda', 'klima', 'radar', 'otopilot', 'bowThruster', 'teak', 'tender'] as const;
export type Currency = (typeof CURRENCIES)[number];
export type BoatType = (typeof BOAT_TYPES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
const pos = z.number().finite().positive().max(1e9);
const year = z.number().int().min(1900).max(2100);
export const parsedQuerySchema = z.object({
  minLength: pos.max(200).optional(), maxLength: pos.max(200).optional(),
  minYear: year.optional(), maxYear: year.optional(),
  minPrice: pos.optional(), maxPrice: pos.optional(),
  currency: z.enum(CURRENCIES).optional(),
  equipment: z.array(z.enum(EQUIPMENT)).max(8).default([]),
  type: z.enum(BOAT_TYPES).optional(),
  location: z.string().max(40).optional(),
}).strip();
export type ParsedQuery = z.infer<typeof parsedQuerySchema>;
```

- [ ] **Step 4:** Kök `package.json`:

```json
{ "name": "teknemisatiyorum", "private": true, "workspaces": ["shared", "api", "mobile"],
  "scripts": { "test": "npm test -w shared && npm test -w api && npm test -w mobile", "dev": "node scripts/dev.mjs" } }
```

`mobile/metro.config.js`: `getDefaultConfig` + `watchFolders: [path.resolve(__dirname, '../shared')]`; `mobile/tsconfig.json` ve `jest.config.js`'e `@tms/shared` → `../shared/src` eşlemesi.

- [ ] **Step 5:** `npm install` (kök) → `npm test -w shared` PASS (taşınan 30+ test + TCKN) · `npm test -w mobile` PASS · `npx tsc --noEmit -w mobile` hatasız · `npx expo export --platform web` (mobile) hatasız.
- [ ] **Step 6: Commit** — `refactor: shared paketi ve npm workspaces`

### Task 2: API iskeleti, veritabanı ve test düzeneği

**Files:** `api/*` iskelet, `api/prisma/schema.prisma`, `api/scripts/db.ts`, `api/src/{main,app.module}.ts`, `api/src/config/env.ts`, `api/src/common/prisma.service.ts`, `api/test/setup.ts`, `api/test/health.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `startDb({ port, dataDir }): Promise<{ url, stop() }>` (scripts/db.ts)
  - `PrismaService`
  - `createTestApp(): Promise<{ app, prisma, http }>`: test/setup.ts; her test dosyası kendi şemasında (`?schema=t_<rastgele>`) `prisma migrate deploy` ile başlar, sonunda şemayı düşürür
  - `GET /health → { ok: true }`

- [ ] **Step 1:** `npx @nestjs/cli new api --package-manager npm --skip-git` (sonra workspace'e uyarla). Bağımlılıklar: `@prisma/client prisma embedded-postgres zod @nestjs/config @nestjs/throttler @nestjs/jwt helmet sharp @anthropic-ai/sdk argon2` + dev `supertest @types/supertest`.
- [ ] **Step 2: Sağlık testi yaz** (`test/health.e2e-spec.ts`): `GET /health` → 200 `{ ok: true }`. Çalıştır → FAIL.
- [ ] **Step 3:** `schema.prisma` — spec §5'teki tabloların tamamı. Enum'lar: `ListingStatus {draft pending published rejected sold removed}`, `VerificationKind {identity usta kaptan eksper firma ruhsat}`, `ReviewStatus {pending approved rejected}`, `LogKind {bakim onarim ekspertiz sahiplik}`, `SubjectKind {listing broker expertise}`, `Role {user moderator admin}`. `audit_log` için Prisma'da yalnızca `create` kullanılır.
- [ ] **Step 4:** `env.ts` zod şeması (eksik gizli değerde süreç anlaşılır hatayla durur); `db.ts` gömülü PostgreSQL (veri `api/.data/pg`, port 54329); `main.ts` helmet + CORS (`CORS_ORIGINS` listesi) + global hata filtresi (Task 3'te) + `/health`.
- [ ] **Step 5:** `npx prisma migrate dev --name init` → `npm run test:e2e -w api` PASS.
- [ ] **Step 6: Commit** — `feat(api): iskelet, prisma şeması, gömülü postgres, test düzeneği`

### Task 3: Ortak katman — hata biçimi, doğrulama, yetki, işlem kaydı, istek sınırlama

**Files:** `api/src/common/{errors,error.filter,zod.pipe,decorators,auth.guard,audit.service}.ts`, `api/test/common.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `AppError(code, messageKey, status, params?)`; hazır: `Errors.notFound()`, `Errors.forbidden()`, `Errors.levelRequired(level)`, `Errors.validation(issues)`
  - `ZodPipe(schema)`
  - `@Public()`, `@Auth({ level?: 0|1|2|3, roles?: Role[] })`, `@CurrentUser()` → `{ id, level, roles }`
  - `AuditService.log(actorId, action, params, targetType, targetId)`
  - `ThrottlerModule` global (IP başına 120 istek/dk)

- [ ] **Step 1: Testler** — sahte bir test controller'ı üzerinden:
  - (a) bildirimsiz uç nokta → 401 `{ code: 'UNAUTHENTICATED' }`
  - (b) `@Auth({ level: 2 })` + seviye 1 anahtar → 403 `{ code: 'LEVEL_REQUIRED', params: { level: 2 } }`
  - (c) zod hatası → 400 `{ code: 'VALIDATION', messageKey: 'errors.validation' }`
  - (d) bilinmeyen hata → 500 `{ code: 'INTERNAL' }`, yığın izi yanıtta yok
  - (e) `AuditService` kaydı eklenir, `prisma.auditLog.update` çağrısı kod tabanında yok (grep testi)

  Çalıştır → FAIL.
- [ ] **Step 2:** Uygula. Guard, `APP_GUARD` olarak kaydedilir ve varsayılanı kapalıdır: metadata yoksa 401.
- [ ] **Step 3:** PASS → **Commit** `feat(api): hata biçimi, yetki, doğrulama, işlem kaydı`

### Task 4: Giriş ve oturumlar (auth)

**Files:** `api/src/adapters/sms.ts`, `api/src/modules/auth/*`, `api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 3
- Produces:
  - `POST /auth/otp {phone}` → 204
  - `POST /auth/verify {phone, code, deviceName}` → `{ accessToken, refreshToken, user }`
  - `POST /auth/refresh {refreshToken}` → aynı biçim
  - `POST /auth/logout`
  - `GET /auth/sessions`, `DELETE /auth/sessions/:id`
  - `SmsSender { send(phone, text) }`; `DevSmsSender` son 50 kodu bellekte tutar (`inbox()`)

- [ ] **Step 1: Testler:**
  - Normal akış (otp → verify → korumalı uç nokta)
  - Yanlış kod 5 kez → 6. denemede doğru kod da `OTP_LOCKED`
  - Süresi geçmiş kod → `OTP_EXPIRED` (saat enjekte edilir)
  - Aynı numaraya 1 dk içinde ikinci kod → 429 `OTP_RATE`
  - Refresh rotation: yeni çift döner, eski refresh ile ikinci deneme → 401 `REFRESH_REUSED` ve o zincirdeki tüm oturumlar iptal
  - Oturum listesi / kapatma
  - **Review Focus 3:** aynı kodla eşzamanlı iki `verify` → biri 200, diğeri 401
  - Telefon numarası E.164'e normalize edilir (`0532…`, `+90 532…` aynı kullanıcı)
- [ ] **Step 2:** Uygula.
  - Kod `crypto.randomInt(0, 1e6)` ile 6 hane üretilir, argon2 ile özetlenir.
  - Tüketim atomiktir: `updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } })` ve `count === 1` kontrolü.
  - JWT, `JWT_SECRET` ile 15 dk.
  - Refresh, 32 bayt rastgele üretilir; SHA-256 özeti saklanır, `replacedById` zinciri kurulur.
- [ ] **Step 3:** PASS → **Commit** `feat(api): telefonla giriş, oturum yenileme ve cihazlar`

### Task 5: Kullanıcılar, kimlik/belge doğrulama, kurumsal hesap, dosyalar

**Files:** `api/src/adapters/{identity,storage}.ts`, `api/src/modules/{users,verification,companies,media}/*`, testler

**Interfaces:**
- Produces:
  - `GET/PATCH /me` (ad, e-posta, dil); `DELETE /me` (anonimleştirme)
  - `POST /verification/identity {tckn?|passport?, firstName, lastName, birthYear}` → seviye 2
  - `POST /verification/requests {kind, fileIds}`; `GET /verification/requests/mine`
  - `POST /media` (multipart; `visibility: public|private`) → `{ id, url? }`; `GET /media/:id` (public) ve `GET /media/:id/signed` (private, sahip ya da moderatör) → 5 dk imzalı URL
  - `POST /companies`, `POST /companies/:id/members`
  - `StorageAdapter { put(buf, key, visibility), get(key), signedUrl(key, ttl) }`

- [ ] **Step 1: Testler:**
  - Geçerli TCKN → seviye 2. Yanıtta yalnızca `nationalIdLast2` bulunur. **Review Focus 1:** tüm `/me` ve admin yanıtları derin taranır, 11 haneli numara bulunmaz.
  - Geçersiz TCKN → 400 `INVALID_TCKN`.
  - Yüklenen jpeg'de EXIF yok; uzun kenar ≤ 2000; 11 MB → 413; `text/plain` → 415.
  - Private dosya başka kullanıcıya → 404 (**Review Focus 2**).
  - `DELETE /me` → telefon/ad/e-posta null, oturumlar iptal, ilanlar "silinmiş kullanıcı" olarak kalır.
- [ ] **Step 2:** Uygula (AES-256-GCM ile `ID_ENC_KEY`; sharp `rotate().resize({width:2000,height:2000,fit:'inside'}).jpeg({quality:82})` EXIF'i atar).
- [ ] **Step 3:** PASS → **Commit** `feat(api): kullanıcılar, doğrulama, kurumsal hesap, güvenli dosyalar`

### Task 6: İlanlar, favoriler, kayıtlı aramalar, kurlar

**Files:** `api/src/modules/listings/*`, `api/src/modules/fx/*`, testler

**Interfaces:**
- Consumes: `@tms/shared` (`parsedQuerySchema`, `failures`), Task 5
- Produces:
  - `POST /listings` (taslak), `PATCH /listings/:id`, `POST /listings/:id/photos {fileIds}`, `POST /listings/:id/submit`, `POST /listings/:id/sold`, `DELETE /listings/:id` (→ removed)
  - `GET /listings?q=<ParsedQuery json>&sort=new|asc|desc&page` → `{ items, total }`
  - `GET /listings/:id`, `GET /me/listings?status=`
  - `PUT/DELETE /favorites/:listingId`, `GET /favorites`
  - `POST /saved-searches {text, filter}`, `GET /saved-searches` (her biri `newMatches` ile)
  - `GET /fx`, `PUT /admin/fx/:currency` (admin)
  - `FxService.rates(): Promise<Rates>`

- [ ] **Step 1: Testler:**
  - Seviye 1 ile submit → 403 `LEVEL_REQUIRED` (prototip incelemesi Important-2'nin sunucu karşılığı).
  - Fotoğrafsız submit → 400 `PHOTO_REQUIRED`.
  - Başkasının taslağını okuma/düzenleme → 404.
  - Yalnızca `published` ilanlar aramada görünür.
  - Aramada TRY/EUR/USD karşılaştırması kur tablosundan yapılır: EUR kuru 48→50 yapılınca sonuç değişir.
  - 21. fotoğraf → 400.
  - Yeni eşleşme sayısı: kayıttan sonra yayına giren eşleşen ilan sayısı.
- [ ] **Step 2:** Uygula. Arama:
  - Prisma ile kaba ön süzme: tip, konum, yıl, boy, `status=published`.
  - Fiyat ve donanım süzmesi `failures(listing, q, rates)` ile bellekte. Beta ölçeği için yeterli. İlan sayısı 5.000'i aşınca SQL'e taşınacağı kod yorumunda yazılır.
- [ ] **Step 3:** PASS → **Commit** `feat(api): ilanlar, favoriler, kayıtlı aramalar ve kur tablosu`

### Task 7: Akıllı Asistan (Claude)

**Files:** `api/src/adapters/llm.ts`, `api/src/modules/assistant/*`, `api/test/assistant.e2e-spec.ts`, `api/scripts/llm-smoke.ts`

**Interfaces:**
- Consumes: `parseQuery`, `parsedQuerySchema`, `matchListings` (shared), `FxService`
- Produces:
  - `LlmClient { toFilter(text): Promise<unknown> }`; uygulamalar: `ClaudeLlmClient`, testte `FakeLlmClient`
  - `POST /assistant/search {text}` → `{ query, exact, near, source }` (`@Public()`; misafir IP kotası)

- [ ] **Step 0:** `claude-api` skill'ini oku; yapılandırılmış çıktı / araç şeması ile JSON döndürme yöntemini ve güncel SDK çağrısını oradan al.
- [ ] **Step 1: Testler (FakeLlmClient):**
  - Normal: sahte filtre döner → sonuçlar veritabanından gelir, `source: 'llm'`.
  - **Review Focus 4:** sahte istemci şunları döndürür → zod eler, arama güvenli alanlarla çalışır:
    - `{ minLength: -5, extra: 'DROP TABLE', equipment: ['jenerator','uçak'] }`
  - İstemci hata fırlatır / 5 sn bekler → `source: 'rules'`, sonuç kural tabanlı ayrıştırıcıyla aynı.
  - Aynı metin ikinci kez → LLM çağrılmaz (önbellek).
  - Misafir 21. sorgu → `source: 'rules'` (kota aşımı kullanıcıyı engellemez, yalnızca LLM'i).
  - LLM'e giden istekte kullanıcı kimliği yoktur (sahte istemci aldığı argümanı kaydeder; yalnızca metin).
- [ ] **Step 2:** Uygula.
  - Sistem istemi: yalnızca filtre alanlarını çıkar, bilinmeyeni boş bırak, ilan üretme.
  - Konum listesi ve donanım anahtarları istemde verilir. Zaman aşımı 4 sn (`AbortController`).
  - Önbellek: bellek içi LRU (1000 kayıt, 24 saat).
  - Kota: `assistant_usage` tablosu ya da bellek içi sayaç. Beta için bellek içi, yeniden başlatmada sıfırlanır; bu yorumla belirtilir.
- [ ] **Step 3:** `scripts/llm-smoke.ts`: gerçek anahtarla tek sorgu gönderir, dönen filtreyi yazdırır (elle çalıştırılır; Task 12'de).
- [ ] **Step 4:** PASS → **Commit** `feat(api): Claude destekli akıllı asistan, önbellek, kota ve yedek`

### Task 8: Tekneler ve karne, mesajlaşma, bildirimler

**Files:** `api/src/modules/{boats,messages,notifications}/*`, testler

**Interfaces:**
- Produces:
  - `GET/POST /boats`, `GET /boats/:id`, `POST /boats/:id/logbook` (sahibi ekler → `verified:false`)
  - İç API: `LogbookService.addVerified(boatId, entry)` (Task 9 ekspertiz raporu kullanır)
  - `GET /conversations`, `POST /conversations {subjectKind, subjectId}` (karşı taraf konudan çıkarılır; aynı konu → aynı sohbet)
  - `GET/POST /conversations/:id/messages`, `POST /conversations/:id/share-phone`, `POST /conversations/:id/read`
  - `GET /notifications`, `POST /notifications/:id/read`; iç API `NotificationsService.push(userId, key, params)`

- [ ] **Step 1: Testler:**
  - Başkasının teknesi/sohbeti → 404 (**Review Focus 2**).
  - Kendi ilanına sohbet açma → 400 `OWN_LISTING` (prototip minor bulgusu).
  - Mesaj alıcıya bildirim düşer.
  - Numara paylaşılınca yalnızca paylaşan tarafın numarası karşıya görünür.
  - Sahibin eklediği karne kaydı `verified:false`.
- [ ] **Step 2:** Uygula → PASS → **Commit** `feat(api): tekneler ve karne, mesajlaşma, bildirimler`

### Task 9: Ekspertiz, broker, yönetim paneli

**Files:** `api/src/modules/{expertise,broker,admin}/*`, `prisma/seed.ts`, testler

**Interfaces:**
- Produces:
  - Ekspertiz: `GET /expertise/packages`, `POST /expertise/bookings {packageId, listingId?, date:'YYYY-MM-DD', slot}`, `GET /me/expertise`
  - Broker: `POST /broker/cases`, `GET /broker/cases/:id`, `GET /me/broker`
  - Yönetim (roller: moderator/admin):
    - `GET /admin/overview`
    - `GET /admin/queue?kind=listing|verification`, `POST /admin/listings/:id/decision {approve|reject, reason?}`, `POST /admin/verifications/:id/decision`
    - `GET /admin/users` (maskeli), `GET /admin/audit`
    - `POST /admin/broker/:id/advance`, `POST /admin/expertise/:id/report {score}` → karneye doğrulanmış kayıt + ilana "ekspertizli" rozeti
    - `GET /admin/dev/otp-inbox` (yalnızca `NODE_ENV!=='production'`)
  - Seed: 25 ilan (prototip tablosu; fotoğraflar `BoatImage` degradelerinden üretilmiş jpeg'ler), 3 paket, 1 admin (`+905000000000`, seviye 3), kurlar EUR 48 / USD 41.

- [ ] **Step 1: Testler:**
  - Moderatör olmayan karar veremez → 403.
  - Onay → ilan yayında + sahibine bildirim + işlem kaydı.
  - Ruhsat onayı → ilana `sahiplik` rozeti.
  - Broker adımı 4'ten sonra ilerlemez ve işlem kaydı yazılmaz (prototip minor bulgusu).
  - Onaylanmış ilan için ikinci karar → 409 `ALREADY_DECIDED` (minor bulgusu).
  - Ekspertiz tarihi `2026-10-01` gönderilir → aynen `2026-10-01` saklanır, saat diliminden bağımsız (minor bulgusu).
  - Üretim modunda otp-inbox → 404.
- [ ] **Step 2:** Uygula → `npx prisma db seed` → PASS → **Commit** `feat(api): ekspertiz, broker, yönetim paneli ve başlangıç verisi`

### Task 10: Uygulamayı API'ye bağlama

**Files:**
- Create: `mobile/src/services/api/{client,hooks,index}.ts`, `mobile/src/services/mock/*` (mevcut `store.ts` taşınır), `mobile/src/services/mode.ts`, `mobile/__tests__/apiClient.test.ts`
- Modify: `mobile/src/services/index.ts`, `mobile/src/session/role.ts`, `mobile/src/app/_layout.tsx` (QueryClientProvider)

**Interfaces:**
- Produces:
  - `apiFetch(path, init)`:
    - giriş anahtarını ekler
    - 401'de **bir kez** refresh deneyip isteği tekrarlar; refresh de 401 dönerse `session.logout()` + `/auth/login`
    - `LEVEL_REQUIRED` → `requireLevel(level)`
  - Hook'lar bugünkü imzalarla aynı (`useListings`, `useListing(id)` …) ve aynı `actions` nesnesi. Gerçek modda eylemler `Promise` döner.
  - `mode.ts`: `getMode(): 'demo'|'api'`; varsayılan `EXPO_PUBLIC_API_URL` tanımlıysa `api`.

- [ ] **Step 1: Testler** (`fetch` taklidiyle):
  - 401 → refresh → tekrar → başarı
  - **Review Focus 5:** refresh de 401 → tek logout, ikinci refresh denemesi yok, döngü yok
  - Paralel iki 401 → tek refresh isteği
  - `LEVEL_REQUIRED` → yönlendirme çağrıldı
- [ ] **Step 2:** Uygula. Anahtarlar `expo-secure-store` (web'de bellek). Ekranlarda gerekli değişiklik: eylemlerin `await` edilmesi, yükleniyor/hata durumları (ortak `QueryState` bileşeni).
- [ ] **Step 3:** Gerçek modda usta, kaptan ve ödeme girişleri `ComingSoon` ekranına gider (i18n: `soon.*`).
- [ ] **Step 4:** `npm test -w mobile` PASS · tsc hatasız → **Commit** `feat(mobile): gerçek API bağlantısı, demo modu anahtarı`

### Task 11: Prototipten ertelenen 7 düzeltme (mobil)

**Files:** ilgili ekranlar + `mobile/__tests__/…`

Kapsam ve test biçimi:

| Bulgu | Test biçimi |
|---|---|
| Sihirbaz önizleme kartı tıklanamaz (`ListingCard` `onPress`/`disabled` prop'u) | Birim: prop verilince yönlendirme çağrılmaz |
| İlan karne kartı ilanın kendi karne özetini gösterir (sunucudan `logbookSummary`) | Kaynak kontrolü |
| Kendi ilanında "Mesaj gönder" gizli | Kaynak kontrolü |
| Telefonla girişten sonra gelinen sayfaya dönüş (`dismissTo` yerine `goBack`) | Kaynak kontrolü |
| Ekspertiz tarihi yerel gün olarak (`toISOString` yok) | Birim: `localDateString(new Date(2026,9,1,1,30))` → `'2026-10-01'` |
| Tema dışı font/yarıçap literalleri → tema değerleri | Grep testi: `src/**/*.tsx`'te `'Inter_` ve `borderRadius: \d` yok |
| Para birimsiz fiyat ("300 bin", "2 milyona kadar") | shared ayrıştırıcıda birim testi; para birimi yoksa `TRY` |

- [ ] Her biri: test → FAIL → düzelt → PASS. **Commit** `fix(mobile): prototipten ertelenen 7 düzeltme`

### Task 12: Tek komutla çalıştırma, yedek, Claude anahtarı, telefona bağlama

**Files:** `scripts/dev.mjs` (kök), `api/scripts/backup.ts`, `api/.env.example`, `README.md` (kök, kısa çalıştırma rehberi)

- [ ] **Step 1:** `scripts/dev.mjs` sırayla:
  1. gömülü PG başlat
  2. `prisma migrate deploy`
  3. veritabanı boşsa seed
  4. API (`:3000`)
  5. Expo; tünel `--tunnel` bayrağıyla, API için ngrok ikinci tünel, `EXPO_PUBLIC_API_URL` otomatik
  6. Ctrl+C hepsini düzgün kapatır
- [ ] **Step 2:** `backup.ts`: `pg_dump` (embedded-postgres ikili dosyalarından) → `api/backups/YYYY-MM-DD.sql`, son 7 dosya tutulur; API ayağa kalkınca günde bir çalışan zamanlayıcı.
- [ ] **Step 3: Claude API anahtarı** — kullanıcıyla birlikte, Claude in Chrome ile:
  1. console.anthropic.com → API Keys → Create key (ad: `teknemisatiyorum-beta`).
  2. Hesapta kredi/fatura tanımlı değilse işlem **durur**; kart bilgisi kullanıcı tarafından girilir.
  3. Anahtar yalnızca `api/.env`'ye yazılır, sohbete ya da git'e yazılmaz.
  4. `npx tsx api/scripts/llm-smoke.ts "12 metreye kadar jeneratörlü 2015 sonrası"` → geçerli filtre.
- [ ] **Step 4:** `npm run dev` → telefonda Expo Go ile aç (kullanıcının personal token'ı `EXPO_TOKEN` olarak yalnızca süreç ortamında).
- [ ] **Step 5: Commit** — `chore: tek komutla geliştirme ortamı, yedekleme, çalıştırma rehberi`

### Task 13: Uçtan uca doğrulama ve kabul

**Files:** `mobile/scripts/demo-flows.mjs` (gerçek mod varyantı), `docs/beta-kabul.md`

- [ ] **Step 1:** Demo betiği gerçek moda uyarlanır. OTP kodu `GET /admin/dev/otp-inbox`'tan okunur, ikinci hesap mesajlaşma için ikinci tarayıcı bağlamında açılır, usta/kaptan akışları "yakında" doğrulamasına dönüşür. Ek akışlar:
  - uygulamayı yeniden yükle → veriler yerinde
  - `ANTHROPIC_API_KEY` boşken asistan yine sonuç verir
- [ ] **Step 2:** Spec §11'deki 6 kabul kriteri tek tek çalıştırılır ve `docs/beta-kabul.md`'ye kanıtıyla yazılır (komut, çıktı, ekran görüntüsü).
- [ ] **Step 3:** `npm test` (kök, üç paket) PASS · `npx tsc --noEmit` her pakette.
- [ ] **Step 4: Commit** — `test: beta kabul kriterleri doğrulandı`
