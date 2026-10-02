# Devir notu — teknemisatıyorum.com (2026-09-27)

## Proje
Tekne alım-satım + broker + ekspertiz + (2. dalga: usta/kaptan/güvenli ödeme) platformu. Monorepo, npm workspaces:
- `shared/` — zod şemaları, Akıllı Asistan kural tabanlı ayrıştırıcısı (`parseQuery`, `matchListings`), kur yardımcıları, TCKN doğrulama, seed ilanları. Test: `npm test -w shared` (30 test).
- `api/` — NestJS 11 + Prisma 6 + PostgreSQL (gömülü; `embedded-postgres` ikilileri, `pg_ctl` ile başlatılır — Windows yönetici oturumunda `postgres` doğrudan başlamıyor). Test: `cd api && npx jest --runInBand` (~80 e2e test, her test dosyası ayrı şema).
- `mobile/` — Expo SDK 57 + Expo Router (`src/app`). Demo modu (sahte zustand deposu) + gerçek mod (sunucu). Test: `npm test -w mobile` (93 test). Uçtan uca: `node mobile/scripts/demo-flows.mjs` (demo modunda 11/11 geçiyor; web sunucusu 8081'de açık olmalı).

- `web/` — Next.js 16 (App Router) vitrin sitesi: iki dil (TR öneksiz, EN `/en`), SEO (başlık, schema.org, site haritası, 410), sitede giriş (HttpOnly çerez, BFF), Öne çıkar ve deneme ödemesi. Ara katman `src/proxy.ts` (Next 16'da middleware'in yeni adı). Test: `npm test -w web`. Kabul: `node web/scripts/web-acceptance.mjs` (6/6).

## Web vitrini ve öne çıkarma (2026-09-27)
- Tasarım: `docs/superpowers/specs/2026-09-27-web-vitrin-design.md`, plan: `docs/superpowers/plans/2026-09-27-web-vitrin.md`, karar kaydı: `.superpowers/sdd/2026-09-27-web-vitrin/progress.md`.
- Ürünler (Vitrin 7/30, Acil 7/30, Üste taşı), siparişler, ödeme adaptörleri (`api/src/adapters/payments.ts`: deneme sanal POS + deneme mağaza makbuzu; `PAYMENTS_MODE=live` Aşama 2'de bağlanacak).
- Hız (Lighthouse mobil, üretim derlemesi): ana sayfa Performans 96 / Erişilebilirlik 96 / SEO 100; ilan detayı 92 / 96 / 100.

## Tasarım dili: "Liman" (2026-10-02)
- Eski "Kıyı Sıcak" (krem zemin, yeşil) yerine kullanıcının seçtiği "Liman": açık zemin `#F6F8FA`, beyaz kart, lacivert ana renk `#0B3B5C`, turuncu vurgu `#F2652B` (yalnızca "İlan ver" düğmesi gibi tek tük yerlerde; turuncu üstüne beyaz yazı yazılmaz, `accentText`/`accentSoft` kullanılır).
- Yazı tipleri: başlık Bricolage Grotesque, metin Figtree (uygulamada `@expo-google-fonts/*`, sitede `next/font`).
- Tek kaynak `shared/src/design.ts`; okunabilirlik (WCAG AA) `shared/__tests__/design.test.ts` ile korunuyor.
- Çizimler (3 yön, A seçildi): https://claude.ai/artifact/MCeVtkeNAFdAKFfyrf2mVT
- İlan kartı çerçevesiz (yuvarlak köşeli fotoğraf, bilgi altında); alt menüde turuncu "İlan ver" düğmesi; ana ekranda tek satır asistan kutusu.
- Ortak bileşenler: `AssistantInput` (asistan kutusu; ana ekran, asistan, hizmetler), `Badge` hap biçimli + ikonlu, `StatusLine`/`Bullet` (metin içine ✓ • gibi işaret yazılmaz, ikon kullanılır), `Section` başlığı 19 px + sağda "Tümü ›". Emoji ve metin işareti yok.
- İlan detayı (uygulama ve site): fotoğraf, rozetler, başlık, fiyat, üç büyük rakam (boy/yıl/kabin), özellik listesi, donanım, açıklama, karne, satıcı.
- Site simgesi: `web/src/app/icon.svg` → `favicon.ico` (32 px, PNG gömülü) ve `public/icon.png` (512 px, schema.org logosu). Üretim: scratch betiği sharp ile çizdi; SVG değişirse yeniden üretilmeli.
- `npx expo lint` 0 uyarı; tasarım dışı kalan tek iş gerçek fotoğraflar ve mağaza simgesi.

## Belgeler
- Tasarım: `docs/superpowers/specs/2026-09-26-arka-uc-dalga1-design.md`
- Plan (13 görev): `docs/superpowers/plans/2026-09-26-arka-uc-dalga1.md`
- Karar kaydı (git dışı): `.superpowers/sdd/2026-09-26-arka-uc-dalga1/progress.md` — `Ruling:` satırları plandan sapmaları açıklar.
- Prototip belgeleri: `docs/superpowers/specs/2026-09-25-prototip-design.md`, `docs/demo-akislari.md`.

## Durum
- Görev 1–12 tamamlandı.
- `npm run dev` gömülü PostgreSQL'i, derlenmiş NestJS sunucusunu ve Expo'yu birlikte açıyor. `http://localhost:8081/api/health` → `{"ok":true}` doğrulandı.
- Görev 12 kapsamı: `mobile/metro.config.js` (`/api/*` → localhost:3000 proxy), çalışma anında API adresi, günlük JSON yedek (son 7 gün), tek komutlu geliştirme ortamı ve `--tunnel`, düzgün kapanış, göreli medya URL'leri ve yalnızca boş veritabanına seed.

## Çözülen açılış hatası
`tsx` decorator metadata üretmediği için çöken API artık `tsc` ile derlenip `node --env-file=.env dist/src/main.js` ile açılıyor. `shared` paketi sunucu için ayrıca `dist` çıktısı üretiyor; Prisma seed ve yardımcı betikler Nest DI kullanmadıkları için `tsx` ile kalıyor. Gerçek başlangıç yolunu açıp `/health` yanıtını denetleyen gerileme testi eklendi.

## Kalan işler
1. Claude API anahtarı: kullanıcı console.anthropic.com'da oluşturur, **yalnızca** `api/.env` içindeki `ANTHROPIC_API_KEY`'e yazılır (git'e/sohbete değil). Deneme: `cd api && node --env-file=.env --import tsx scripts/llm-smoke.ts "12 metreye kadar jeneratörlü 2015 sonrası"`. Model: `claude-haiku-4-5`.
2. Telefonda deneme: `EXPO_TOKEN` (kişisel Expo erişim anahtarı) yalnızca ortam değişkeni olarak verilir, `npm run dev -- --tunnel`. Expo Go'da `exp://…exp.direct` adresi açılır. Giriş kodu SMS yerine yönetim panelindeki gelen kodlar kutusuna düşer (`GET /admin/dev/otp-inbox`; yönetici `+905000000000`).
3. Görev 13: demo betiğini gerçek moda uyarla ve spec §11'deki 6 kabul kriterini `docs/beta-kabul.md`'ye kanıtla yaz.
4. Son bağımsız kod incelemesi; sonra 2. dalga (usta/kaptan/güvenli ödeme), web vitrini (SEO), hukuk araştırması (KVKK, 6563, ödeme kuruluşu) → avukat onayı.

## Kurallar
- Her değişiklikten önce test yaz, düştüğünü gör, sonra uygula (TDD). Commit mesajları Türkçe.
- Ekranlarda sabit Türkçe metin yok: her metin `mobile/src/i18n/{tr,en}.json` (tr/en anahtar eşitliği testle korunuyor). Yeni anahtarlar `mobile/scripts/i18n/*.json` + `node scripts/i18n-merge.js` ile eklenir.
- Renk/yazı tipi/yarıçap yalnızca `mobile/src/theme` üzerinden (testle korunuyor).
- Sunucu uç noktaları varsayılan kapalı: her controller `@Public()` ya da `@Auth({level, roles})` taşır. Kimlik numarası hiçbir yanıtta dönmez.
- Gizli değerler (`api/.env`, Expo/Anthropic anahtarları) asla commit edilmez.
