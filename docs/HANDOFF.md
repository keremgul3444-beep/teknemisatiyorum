# Devir notu — teknemisatıyorum.com (2026-09-26)

## Proje
Tekne alım-satım + broker + ekspertiz + (2. dalga: usta/kaptan/güvenli ödeme) platformu. Monorepo, npm workspaces:
- `shared/` — zod şemaları, Akıllı Asistan kural tabanlı ayrıştırıcısı (`parseQuery`, `matchListings`), kur yardımcıları, TCKN doğrulama, seed ilanları. Test: `npm test -w shared` (30 test).
- `api/` — NestJS 11 + Prisma 6 + PostgreSQL (gömülü; `embedded-postgres` ikilileri, `pg_ctl` ile başlatılır — Windows yönetici oturumunda `postgres` doğrudan başlamıyor). Test: `cd api && npx jest --runInBand` (~80 e2e test, her test dosyası ayrı şema).
- `mobile/` — Expo SDK 57 + Expo Router (`src/app`). Demo modu (sahte zustand deposu) + gerçek mod (sunucu). Test: `npm test -w mobile` (93 test). Uçtan uca: `node mobile/scripts/demo-flows.mjs` (demo modunda 11/11 geçiyor; web sunucusu 8081'de açık olmalı).

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
