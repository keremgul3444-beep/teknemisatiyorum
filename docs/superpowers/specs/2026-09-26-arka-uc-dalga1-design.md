# teknemisatıyorum.com — Arka Uç, 1. Dalga (Kapalı Beta) Tasarımı

- **Tarih:** 2026-09-26
- **Durum:** Kullanıcı onayı bekliyor
- **Önceki belge:** `2026-09-25-prototip-design.md` (tıklanabilir prototip — tamamlandı)

## 1. Amaç ve kapsam

Prototipin sahte veri katmanını gerçek bir arka uçla değiştirip uygulamayı **kalıcı veriyle çalışan kapalı bir betaya** dönüştürmek. Beta bu bilgisayarda çalışır, telefona tünelle açılır, halka açık değildir (hukuk araştırması ve avukat onayı tamamlanmadan gerçek kullanıcı verisi toplanmaz).

**Bu turda:** giriş/oturumlar, kullanıcılar ve doğrulama seviyeleri, kurumsal hesap, ilanlar (taslak → onay → yayın), fotoğraf/belge yükleme, favoriler, kayıtlı aramalar, Akıllı Asistan (Claude), tekneler ve Tekne Karnesi, mesajlaşma, ekspertiz randevuları, broker dosyaları, yönetim paneli (onay kuyrukları, kullanıcılar, işlem kaydı), kur tablosu.

**Bu turda değil:** usta/servis pazar yeri, kaptan kiralama, güvenli ödeme (2. dalga — uygulamada "yakında" olarak görünür, prototip ekranları korunur); Google'da görünen web vitrini (ayrı tur); gerçek SMS, NVİ, bulut depolama (takma yuva olarak hazırlanır); mesafe bazlı harita araması; push bildirimleri (uygulama içi bildirim listesi var, push sonraki tur).

## 2. Alınmış kararlar

| Konu | Karar |
|---|---|
| Barındırma | Taşınabilir kurulum: standart Node + PostgreSQL. Şimdilik bu bilgisayar; bulut yeri (TR/AB) hukuk araştırmasından sonra |
| Dış servisler | Kendi kendine çalışan çekirdek + takma yuvalar; **Claude API şimdiden gerçek** |
| Teknoloji | TypeScript uçtan uca · NestJS (modüler tek sunucu) · PostgreSQL · Prisma (şema + migration) · zod (paylaşılan doğrulama) · Expo uygulaması TanStack Query ile |
| Yerel veritabanı | `embedded-postgres` (kurulum gerektirmez); başka ortamda herhangi bir PostgreSQL 16+ |
| Web vitrini | Ayrı tur |

## 3. Depo yapısı

```
teknemisatiyorum/
  mobile/   mevcut Expo uygulaması (servis katmanı gerçek API'ye bağlanır)
  api/      NestJS sunucu
  shared/   ortak tipler, zod şemaları, kural tabanlı asistan ayrıştırıcısı, kur/fiyat yardımcıları
```
`shared/` hem uygulamada hem sunucuda kullanılır; prototipteki `features/assistant/parse.ts`, `match.ts`, `chips.ts` ve `services/rates.ts` buraya taşınır.

## 4. Sunucu modülleri

| Modül | Sorumluluk |
|---|---|
| auth | Telefon + tek kullanımlık kod, giriş/yenileme anahtarları, oturum (cihaz) listesi ve kapatma |
| users | Profil, dil, doğrulama seviyeleri (0–3), roller, hesap silme (anonimleştirme) |
| companies | Kurumsal hesap, personel ve rolleri |
| verification | Kimlik ve profesyonel belge başvuruları, moderasyon kararları |
| listings | CRUD, durum makinesi, arama/filtre, favoriler, kayıtlı aramalar |
| media | Yükleme; herkese açık (ilan fotoğrafı) ve korumalı (kimlik, ruhsat) ayrı alanlar |
| assistant | Claude ile metin → filtre; doğrulama; yedek ayrıştırıcı; önbellek ve kota |
| boats | Tekneler ve karne kayıtları |
| messages | Sohbetler, mesajlar, numara paylaşma |
| expertise | Paketler, randevular, rapor durumu |
| broker | Dosyalar ve adımları |
| admin | Onay kuyrukları, kullanıcı listesi (maskeli), işlem kaydı, kur tablosu, gelen kod kutusu (geliştirme) |
| audit | Değiştirilemez işlem kaydı |
| notifications | Uygulama içi bildirim listesi (onay/red, yeni mesaj, yeni eşleşme) |

### Takma yuvalar (her biri tek arayüz + yerel uygulama)
| Yuva | Şimdi | Sonra |
|---|---|---|
| SmsSender | Kod sunucu kaydına ve yönetim panelindeki "gelen kodlar" kutusuna düşer | Türk SMS sağlayıcısı |
| IdentityVerifier | TCKN algoritmik geçerlilik kontrolü (+ ad/soyad/yıl dolu) | NVİ doğrulama servisi |
| FileStorage | Yerel disk (`api/storage/public`, `api/storage/private`) | S3 uyumlu bulut depolama |
| LlmClient | **Claude API (gerçek)** | — |
| Mailer | Sunucu kaydı | E-posta servisi |

## 5. Veri modeli

| Tablo | Alanlar (özet) | Kural |
|---|---|---|
| users | id, phone (benzersiz), name, email?, lang, verifyLevel, roles[], nationalIdEnc?, nationalIdLast2?, deletedAt? | Kimlik numarası uygulama düzeyinde AES-256-GCM ile şifreli; yalnızca son 2 hane okunur |
| sessions | id, userId, deviceName, lastSeenAt, refreshHash, revokedAt?, replacedById? | Yenileme anahtarının yalnızca özeti (SHA-256) |
| otp_codes | phone, codeHash, attempts, expiresAt, consumedAt? | 5 dk geçerli, en fazla 5 deneme, numara başına dakikada 1 kod |
| companies / company_members | ad, tür, şehir / userId, rol | Personel firma adına ilan verebilir |
| verification_requests | userId, kind (kimlik/usta/kaptan/eksper/firma/ruhsat), fileIds[], status, rejectReason?, reviewedBy? | Belgeler korumalı depoda; yalnızca moderatör rolü açar |
| listings | id, ownerUserId, companyId?, brand, model, year, lengthM, type, price, currency, location, equipment[], cabins, engine, description, status, badges[], createdAt, publishedAt? | Durum: taslak → onay-bekliyor → yayında / reddedildi → satıldı / kaldırıldı; kalıcı silme yok |
| listing_photos | listingId, fileId, order | İlk fotoğraf kapak; yüklemede küçültme + EXIF silme |
| favorites / saved_searches | userId, listingId / userId, text, filter(json), lastCheckedAt | Yeni eşleşme = kayıttan sonra yayına giren ve filtreye uyan ilanlar |
| boats / logbook_entries | ownerUserId, ad, marka, model, yıl, boy / boatId, kind, date, title, byName, verified, sourceRef? | Platform kaynaklı kayıt `verified=true`; sahibinin eklediği `false` |
| conversations / messages | subjectKind, subjectId, participantIds[], phoneSharedBy[] / senderId, text, createdAt | Yalnızca taraflar okur/yazar |
| expertise_packages / expertise_bookings | ad, fiyat, maddeler / userId, packageId, listingId?, date (yerel gün, `date` tipi), slot, reportStatus | Tarih UTC'ye çevrilmeden gün olarak saklanır |
| broker_cases | userId, boatName, askingPrice, currency, step (0–4), assigneeId? | Adım yalnızca ileri gider |
| fx_rates | currency, rateToTry, updatedAt, updatedBy | Yönetici elle girer (sonra otomatik) |
| audit_log | actorId, action (çeviri anahtarı), params(json), targetType, targetId, at | Yalnızca ekleme; güncelleme/silme yok |
| notifications | userId, key, params, readAt? | Uygulama içi liste |

**Hesap silme:** kişisel alanlar (telefon, ad, e-posta, kimlik) temizlenir, kullanıcı "silinmiş kullanıcı" olarak anonimleşir; ilan ve karne geçmişi korunur; yasal saklama gerektiren kayıtlar ayrı tutulur (şimdilik yok — ödeme 2. dalgada).

## 6. Ana akışlar

### 6.1 Giriş
1. `POST /auth/otp` {phone} → 6 haneli kod üretilir, özeti saklanır, SmsSender'a verilir.
2. `POST /auth/verify` {phone, code, deviceName} → doğruysa kullanıcı yoksa oluşturulur, verifyLevel ≥ 1; yanıt: giriş anahtarı (JWT, 15 dk) + yenileme anahtarı (rastgele, 30 gün).
3. `POST /auth/refresh` → yenileme anahtarı döndürülür (rotation). **Kullanılmış bir yenileme anahtarı tekrar gelirse** o oturum zinciri tümüyle iptal edilir.
4. `GET /auth/sessions`, `DELETE /auth/sessions/:id` → "Cihazlar" ekranı.
5. İstek sınırlama: kod gönderme numara başına 1/dk ve IP başına 10/saat; doğrulama 5 deneme.

### 6.2 Doğrulama
- Kimlik (Seviye 2): IdentityVerifier geçerse seviye 2; numara şifreli saklanır.
- Profesyonel (Seviye 3) ve ruhsat: belge yüklenir → `verification_requests` (bekliyor) → moderatör onay/red (gerekçeli) → bildirim + işlem kaydı. Ruhsat onayı ilgili ilana "sahiplik" rozeti verir.

### 6.3 İlan
- Taslak oluştur/güncelle, fotoğraf ekle/sırala (en fazla 20, her biri ≤ 10 MB, jpeg/png/heic → jpeg'e çevrilir, uzun kenar ≤ 2000 px, EXIF silinir).
- `POST /listings/:id/submit`: **sunucuda** seviye ≥ 2 ve en az 1 fotoğraf şartı.
- Moderasyon: onay → `yayında`, `publishedAt`; red → gerekçe; her ikisi bildirim + işlem kaydı.
- Arama: `GET /listings?filter=…` — `shared` içindeki filtre şeması; fiyat karşılaştırması `fx_rates` ile TRY üzerinden; yalnızca `yayında`.

### 6.4 Akıllı Asistan
1. `POST /assistant/search` {text}.
2. Önbellek (normalize metin → filtre, 24 saat) varsa kullanılır.
3. Yoksa Claude'a yalnızca metin gönderilir; model, `shared` filtre şemasına uyan JSON döndürmekle sınırlandırılır (yapılandırılmış çıktı / araç şeması). Kullanıcı kimliği ve kişisel veri gönderilmez.
4. Dönen filtre zod ile doğrulanır; geçersiz alanlar atılır.
5. Claude hata, zaman aşımı (4 sn) ya da günlük bütçe sınırı durumunda kural tabanlı ayrıştırıcı kullanılır; yanıtta `source: "llm" | "rules"` alanı (yalnızca kayıt için).
6. Sonuç veritabanından: tam eşleşenler + tek kriteri eksik yakın sonuçlar (en fazla 5).
7. Kota: kullanıcı başına günde 50, misafir IP başına günde 20 asistan sorgusu. Model: hızlı/ekonomik Claude modeli — Claude Haiku 4.5 (`claude-haiku-4-5-20251001`); model adı ayardan değiştirilebilir.

### 6.5 Mesajlaşma
- Sohbet konusu ilan / broker / ekspertiz; aynı konu için taraflar arasında tek sohbet.
- Yeni mesaj alıcıya bildirim düşürür; uygulama sohbet açıkken kısa aralıklı yeniler (anlık bağlantı sonraki tur).
- Numara paylaşma tek yönlü ve kayıtlı.

### 6.6 Hata biçimi
Tüm hatalar `{ code, messageKey, params? }`; uygulama `messageKey`'i kullanıcının dilinde gösterir. Yetki hatası `403 { code: "LEVEL_REQUIRED", level: 2 }` biçiminde döner; uygulama ilgili doğrulama ekranına yönlendirir.

## 7. Güvenlik temeli
- JWT imza anahtarı, kimlik şifreleme anahtarı ve Claude API anahtarı yalnızca `api/.env`'de (git dışı); `.env.example` şablonu depoda.
- Rol bazlı yetki (kullanıcı, kurumsal-personel, moderatör, yönetici); her uç noktada açık yetki bildirimi, varsayılan kapalı.
- Girdi doğrulama (zod) her uç noktada; yükleme türü ve boyut sınırı; güvenlik başlıkları (helmet); CORS yalnızca uygulama/tünel adresleri.
- Yönetici listelerinde telefon ve kimlik maskeli; tam görüntüleme işlem kaydına düşer.
- Korumalı dosyalar yalnızca yetkili, süreli imzalı bağlantıyla indirilir.

## 8. Uygulama (mobile) değişiklikleri
- `src/services` arkasına iki uygulama: `mock` (bugünkü) ve `api` (TanStack Query + fetch istemcisi). Ayarlar > Demo'da "Demo modu" anahtarı.
- Oturum anahtarları cihazda güvenli depoda (`expo-secure-store`; web'de bellek).
- `session/role.ts` gerçek oturumdan beslenir; `requireLevel` sunucunun `LEVEL_REQUIRED` yanıtıyla da tetiklenir.
- Usta, kaptan ve güvenli ödeme ekranları gerçek modda "Yakında" rozetiyle gösterilir (tıklanınca bilgi ekranı).
- Prototip incelemesinden ertelenen 12 küçük bulgudan bu turdaki ekranları etkileyenler kapatılır: önizleme kartı, yabancı ilanın karne bağlantısı, kendi ilanına mesaj, girişten sonra geri dönüş, ekspertiz tarihi kayması, tema dışı font/yarıçap değerleri, para birimsiz fiyat ("300 bin").

## 9. Test
- **Birim:** filtre şeması ve doğrulama, kur karşılaştırması, ilan durum makinesi, yetki kuralları, TCKN algoritması, maskeleme.
- **Sunucu entegrasyon:** her modül geçici veritabanına karşı gerçek HTTP istekleriyle (supertest). Zorunlu senaryolar: seviye 2 olmadan ilan onaya gönderilemez; başkasının sohbeti okunamaz/yazılamaz; 6. yanlış kod reddedilir; kullanılmış yenileme anahtarı zinciri iptal eder; moderatör olmayan onay veremez; korumalı dosya yetkisiz indirilemez.
- **Claude:** gerçek API testte çağrılmaz; sabit yanıtlar + hata/zaman aşımında kural tabanlı yedeğin devreye girdiği test edilir. Ayrı, elle çalıştırılan küçük bir "canlı duman testi" komutu gerçek API'yi bir kez dener.
- **Uçtan uca:** `mobile/scripts/demo-flows.mjs` gerçek moda uyarlanıp çalıştırılır (usta/kaptan akışları gerçek modda "yakında" doğrulamasına dönüşür).

## 10. Çalıştırma
- `npm run dev` (depo kökü): gömülü PostgreSQL → migration → başlangıç verisi (prototipteki 25 ilan, eksper paketleri, bir yönetici hesabı) → API → Expo.
- Gece yedeği: `pg_dump` her gün, son 7 yedek `api/backups/` altında.
- Telefon: Expo tüneli + API için ikinci tünel adresi; uygulama API adresini ortam ayarından okur.

## 11. Kabul kriterleri
1. Telefonda gerçek numarayla giriş; kod yönetim panelindeki gelen kodlar kutusundan okunur.
2. Kimlik doğrulanır, fotoğraflı ilan verilir, yönetim panelinde onaylanır, Keşfet'te görünür.
3. Asistan Claude ile çalışır; Claude devre dışıyken de sonuç verir.
4. İki ayrı hesap mesajlaşır; uygulama kapatılıp açıldığında veriler yerindedir.
5. Tekne Karnesi, favoriler, kayıtlı aramalar, ekspertiz randevusu ve broker başvurusu kalıcıdır.
6. Tüm testler geçer; bağımsız kod incelemesinden geçer.

## 12. Açık kalan ve bu tur dışı
- Bulut sağlayıcı ve veri yerleşimi (TR/AB) — hukuk araştırması sonucu.
- SMS sağlayıcı, NVİ entegrasyonu, bulut depolama, e-posta — hesaplar açılınca yuvalara takılır.
- Push bildirimleri, anlık mesajlaşma bağlantısı, harita/mesafe araması, web vitrini, 2. dalga modülleri.
