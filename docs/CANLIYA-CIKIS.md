# Canlıya çıkış rehberi

Tek sunucuda PostgreSQL + API + site + Caddy (otomatik HTTPS). Dosyalar `deploy/` klasöründe.
Bu rehber sırayla izlenir; her adımın sonunda ne görmen gerektiği yazılı.

## 0. Açılmadan önce bilmen gerekenler

- **Ödemeler kapalı açılır** (`PAYMENTS_MODE=off`). İlan, mesaj, usta ve kaptan profilleri, iş talebi ve teklifler çalışır; ödeme isteyen her adım "Ödemeler şu an kapalı" der. Gerçek ödeme için lisanslı bir ödeme kuruluşuyla (pazaryeri / alt üye işyeri modeli) anlaşma ve `live` bağlantısı gerekir. Usta/kaptan emanet ödemesinde parayı platform tutup sonra aktardığı için bu, 6493 sayılı Kanun kapsamında lisanslı kuruluş üzerinden yapılmalıdır.
- **SMS sağlayıcısı olmadan kimse giriş yapamaz.** Giriş kodu SMS ile gider; canlıda `SMS_MODE=dev` sunucuyu durdurur.
- `deploy/.env` yalnızca sunucuda durur, git'e girmez. `ID_ENC_KEY`'i kaybetme: kimlik numaraları ve buluttaki yedekler bu anahtarla şifreli.

## 1. Sunucu ve alan adı

1. Bir Linux sunucu (Ubuntu 24.04, en az 2 GB RAM, 2 çekirdek; Hetzner/DigitalOcean vb.). Docker kur: `curl -fsSL https://get.docker.com | sh`.
2. Güvenlik duvarı: yalnızca 22, 80, 443 açık (`ufw allow 22,80,443/tcp && ufw enable`).
3. DNS'te üç A kaydı, hepsi sunucunun IP'sine:
   - `alanadi.com`
   - `www.alanadi.com`
   - `api.alanadi.com`
4. Kontrol: `dig +short api.alanadi.com` sunucunun IP'sini döndürmeli.

## 2. SMS sağlayıcısı

İki seçenek de kodda hazır (`api/src/adapters/sms.ts`):

- **Netgsm** (`SMS_MODE=netgsm`): hesap aç, SMS başlığını (gönderici adı) onaylat, panelden API alt kullanıcısı oluştur (IP kısıtı koyarsan sunucunun IP'sini ekle). `SMS_USER` = abone numarası / kullanıcı kodu, `SMS_PASSWORD` = API alt kullanıcı şifresi, `SMS_SENDER_NAME` = onaylı başlık. Bağlantı Netgsm'in resmî kütüphanesindeki REST v2 ucuyla aynı (`/sms/rest/v2/send`, başarı `code: "00"`). Hata kodları: 30 yetki/IP, 40 başlık tanımsız, 80 gönderim sınırı. İlk girişte telefona kod gelmesi yeterli kanıttır.
- **Twilio** (`SMS_MODE=twilio`): `SMS_USER` = Account SID, `SMS_PASSWORD` = Auth Token, `SMS_SENDER_NAME` = gönderen numara. Türkiye'ye teslimatta başlık kaydı gerekebilir.

## 3. Bulut depolama ve yedek (önerilir)

Cloudflare R2'de bir kova ve S3 API anahtarı aç. `STORAGE_DRIVER=s3`, `S3_*` ve `BACKUP_OFFSITE=1` ile fotoğraflar, belgeler ve günlük şifreli yedek buluta gider. Sunucu diskinde de 7 günlük yedek tutulur (`backups` biriminde). Yedeği açmak: `api/scripts/backup-decrypt.ts` ve aynı `ID_ENC_KEY`.

Yerel diskle açmak istersen `STORAGE_DRIVER=local` yaz ve `BACKUP_OFFSITE=0` yap. Dosyalar `storage` biriminde durur, sunucu giderse dosyalar da gider.

## 4. Ayarlar

```sh
git clone <depo> tms && cd tms
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Doldurulacaklar (rastgele değer: `openssl rand -base64 48`, `ID_ENC_KEY` için `openssl rand -base64 32`, webhook için `openssl rand -hex 32`):

| Ayar | Değer |
|---|---|
| `DOMAIN` | alan adı (www'suz) |
| `DB_PASSWORD`, `JWT_SECRET`, `ID_ENC_KEY`, `PAYMENT_WEBHOOK_SECRET` | rastgele |
| `SEED_ADMIN_PHONE` | yönetici cep telefonun, `+905XXXXXXXXX` |
| `SMS_*` | 2. adım |
| `S3_*` | 3. adım |
| `PAYMENTS_MODE` | `off` (sağlayıcı bağlanana kadar) |
| `ANTHROPIC_API_KEY` | isteğe bağlı; boşsa asistan kural tabanlı çalışır |

`PUBLIC_URL` (`https://api.DOMAIN`), `WEB_URL`, `CORS_ORIGINS` ve veritabanı adresi compose dosyasında `DOMAIN`'den türetilir, ayrıca yazılmaz.

## 5. Açılış

```sh
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f api
```

API açılışta migration'ları uygular ve başlangıç verisini (yönetici, kurlar, paketler) yükler. Ayar eksikse hangi ayarın eksik olduğunu yazıp durur.

Kontrol:
- `curl https://api.alanadi.com/health/ready` → `{"ok":true}` (veritabanıyla birlikte; `/health` yalnızca sürecin ayakta olduğunu söyler)
- `https://alanadi.com` açılıyor, kilit simgesi var (Caddy sertifikayı ilk istekte alır; DNS yayılmadıysa birkaç dakika bekle).
- Sitede telefonunla giriş yap: SMS geliyor mu? Yönetici numarasıyla girince `/yonetim` açılmalı.

## 6. Mobil uygulama

Paket kimliği iOS ve Android'de `com.teknemisatiyorum.app` (`mobile/app.json`; mağazaya ilk yüklemeden sonra değiştirilemez). Derleme ayarları `mobile/eas.json`: `preview` (deneme, Android APK) ve `production` (mağaza). Alan adı farklıysa `eas.json` içindeki `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WEB_URL` ve `app.json` içindeki `associatedDomains` / `intentFilters` güncellenir.

1. Apple Developer ve Google Play Console hesapları.
2. `cd mobile && npx eas-cli login && npx eas-cli init` (Expo proje kimliğini `app.json`'a yazar; anlık bildirim bunsuz çalışmaz).
3. Deneme: `npx eas-cli build -p android --profile preview` → çıkan APK telefona kurulur.
4. Mağaza: `npx eas-cli build -p all --profile production`, sonra `npx eas-cli submit -p ios` / `-p android`.
5. İlan bağlantıları uygulamada açılsın: `deploy/.env`'e `APPLE_TEAM_ID` (Apple Developer > Membership) ve `ANDROID_CERT_SHA256` (Play Console > Uygulama bütünlüğü > uygulama imzalama anahtarı SHA-256) yazılır. Kontrol: `https://alanadi.com/.well-known/apple-app-site-association` ve `/.well-known/assetlinks.json` açılmalı.
6. Zorunlu güncelleme: eski sürümün çalışmaması gereken bir değişiklikte `MIN_APP_VERSION` yeni sürüme çekilir (ör. `1.1.0`); eski uygulamalar "Güncelle" ekranı görür ve `APP_STORE_URL_*` sayfası açılır. Mağaza onayı beklenirken yükseltme: önce yeni sürüm yayına girsin.

## 7. İzleme

- Kesinti takibi: UptimeRobot (ücretsiz) ile `https://api.alanadi.com/health/ready` ve `https://alanadi.com` 5 dakikada bir. Veritabanı düşerse `/health/ready` 503 döner.
- Hata takibi: `ERROR_DSN`'e Sentry ya da GlitchTip proje DSN'i yazılır. Beklenmeyen 500 hataları, arka plan işleri (emanet taraması, süre taraması, yedek, dosya temizliği) ve çöken süreç bildirilir. Gönderilen: hata türü, kısaltılmış mesaj, yığın izi, yol kalıbı (`/listings/:id`). Kimlik, telefon, sorgu dizesi gönderilmez. Sentry yurt dışında olduğu için KVKK açısından en temizi GlitchTip'i kendi sunucunda ya da AB'de barındırmak; Sentry seçilirse aydınlatma metnine eklenmeli.
- Kayıtlar: `docker compose -f deploy/docker-compose.yml logs api`.
- Disk: `df -h` ve `docker system df` ayda bir.

## 8. Kapasite (yük testi, 2026-10-03)

Tek API süreci, 4 çekirdek, 25 demo ilan; karışık okuma (ilan listesi, filtreli arama, ilan detayı, vitrin, sağlık):

| Eşzamanlı bağlantı | İstek/sn | p50 | p99 | Hata |
|---|---|---|---|---|
| 10 | 365 | 20 ms | 66 ms | 0 |
| 50 | 374 | 87 ms | 290 ms | 0 |
| 200 | 360 | 296 ms | 1,1 sn | 0 |

Doyma noktası saniyede ~370 istek; üstünde istekler kuyrukta bekler, hata vermez. API belleği yükte ~440 MB. Site sayfaları önbellekli olduğu için ziyaretçi başına API isteği azdır; açılış için tek sunucu yeterli. Tekrar ölçmek: API'yi açıp `autocannon` ile aynı yolları rastgele `X-Forwarded-For` ile çağır (IP başına dakikada 120 istek sınırı var).

## 9. Güncelleme

```sh
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

Migration'lar açılışta otomatik uygulanır. Önce yedek almak için: `docker compose -f deploy/docker-compose.yml exec db pg_dump -U tms tms > yedek-$(date +%F).sql`.

## 10. Canlıya çıkmadan önce hukuki kontrol listesi

- KVKK aydınlatma ve açık rıza metinleri avukat onaylı; yurt dışına aktarım (Cloudflare R2, Expo push, Anthropic, Twilio seçilirse) metinlerde ve gerekiyorsa açık rızayla.
- VERBİS kaydı, ticari ileti için İYS.
- Ödeme açılmadan önce: lisanslı ödeme kuruluşu anlaşması, mesafeli satış sözleşmesi ve ön bilgilendirme formu (öne çıkarma paketleri ve hizmet bedeli için), komisyon faturaları için e-fatura/e-arşiv.
