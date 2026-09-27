# teknemisatıyorum.com — Web Vitrini ve Öne Çıkarma Tasarımı

- **Tarih:** 2026-09-27
- **Durum:** Kullanıcı onayı bekliyor
- **Önceki belgeler:** `2026-09-25-prototip-design.md` (prototip — tamam), `2026-09-26-arka-uc-dalga1-design.md` (kapalı beta arka ucu — tamam)
- **Ertelenenler:** `docs/YAPILACAKLAR.md` (kullanıcı her aşama sonunda hatırlatılmak istiyor)

## 1. Amaç ve kapsam

**Amaç:** İlanlar Google'da bulunsun, ziyaretçi bilgisayardan ve telefondan tarayıcıyla ilan gezsin, sonunda uygulamaya ya da satıcıya yönelsin. İlk günden gelir: ilan sahipleri **Vitrin**, **Acil** ve **Üste taşı** ürünlerini hem sitede hem uygulamada satın alabilsin.

**Bu turda (Aşama 1):**
- Next.js web sitesi: herkese açık vitrin + hizmet tanıtım sayfaları + usta/kaptan tanıtım ve katılım sayfaları + yasal sayfalar.
- Sitede telefonla giriş; yalnızca **Hesabım / İlanlarım / Öne çıkar / Ödeme** sayfaları.
- Öne çıkarma ürünleri, siparişler, süre kuralları; sitede, uygulamada ve arama sonuçlarında görünmeleri.
- İki ödeme yolu, **deneme modunda**: site için sanal POS adaptörü, uygulama için Apple/Google makbuz doğrulama adaptörü. Gerçek para çekilmez, akış baştan sona gerçektir.
- Yönetici için elle etkinleştirme (havale), iade, sipariş listesi, ürün fiyatları — uygulamadaki yönetim ekranlarında.

**Bu turda değil (Aşama 2 ve sonrası, `YAPILACAKLAR.md`'de):** gerçek sanal POS ve gerçek mağaza ödemesi (hesaplar açılınca adaptör değişir, geri kalan kod değişmez), siteden mesajlaşma/favori/ilan verme, web yönetim ve firma panelleri, usta/kaptan rehber sayfaları (2. dalga arka ucu gerekir), blog, istatistik aracı seçimi, canlı sunucu.

## 2. Alınmış kararlar

| Konu | Karar |
|---|---|
| Önce hangi web parçası | Herkese açık vitrin (A); yönetim ve firma panelleri sonra |
| Sitede işlem düzeyi | Vitrin + yalnızca öne çıkarma satın almak için giriş |
| Altyapı | Next.js (App Router), monorepo'da `web/` |
| Öne çıkarma | Vitrin 7/30 gün, Acil 7/30 gün, Üste taşı (tek sefer) — hepsi bu turda |
| Ödeme yeri | İkisi birden (C): sitede sanal POS, uygulamada Apple/Google ödemesi; ürün başına ayrı site/uygulama fiyatı |
| Gerçek ödeme | Aşama 2; bu turda deneme adaptörleri |
| Usta/kaptan | Bu turda tanıtım + katılım sayfaları; rehber sayfaları 2. dalga arka ucuyla |
| Dil | TR (öneksiz) + EN (`/en/...`) |

## 3. Sayfalar ve adresler

EN karşılıkları `/en/` altında aynı yapıda (`/en/listings`, `/en/listing/...`, `/en/for-sale/sailboat/bodrum` …).

| Adres | İçerik | Google |
|---|---|---|
| `/` | Asistan arama kutusu, Vitrin (≤8, karışık sıra), Acil satılıklar (≤8), Son eklenenler, şehir/tip kısayolları, ekspertiz/broker tanıtımı, uygulama indirme | açık |
| `/ilanlar` | Filtreler (tip, şehir, boy, yıl, fiyat, donanım, sadece acil), sıralama (yeni/ucuz/pahalı), sayfalama; üstte aramaya uyan ≤3 vitrin ilanı | açık (asıl adres işaretli) |
| `/satilik/[tip]` ve `/satilik/[tip]/[sehir]` | Hazır arama sayfaları; tip/şehir başlığı ve kısa açıklama | ≥3 ilan varsa açık, yoksa kapalı |
| `/ilan/[slug]` | Slug `marka-model-yil-<id>`; galeri, fiyat (TL/EUR/USD), özellikler, rozetler, karne özeti, "Satıcıya yaz"/"Ekspertiz iste" (uygulamaya derin bağlantı, yoksa mağaza), benzer ilanlar | açık; yanlış slug → 301 doğru adrese |
| `/asistan?q=` | Tam eşleşenler + bir kriter eksik olanlar | kapalı |
| `/ekspertiz`, `/broker`, `/tekne-karnesi` | Hizmet tanıtımı; ekspertiz paketleri ve fiyatları sunucudan | açık |
| `/usta`, `/kaptan` | Hizmet tanıtımı, kategoriler, güvenli ödeme/karne avantajı, "yakında" + uygulamaya yönlendirme | açık |
| `/usta-ol`, `/kaptan-ol` | Hizmet verene katılım: nasıl işler, gereken belgeler, uygulamadaki başvuruya yönlendirme | açık |
| `/hakkimizda`, `/iletisim` | Kurumsal | açık |
| `/kvkk`, `/gizlilik`, `/kullanim-kosullari`, `/cerezler` | Yasal metinler, avukat onayına kadar "taslak" şeridiyle | açık |
| `/giris` | Telefon + kod | kapalı |
| `/hesabim`, `/hesabim/ilanlar`, `/hesabim/ilanlar/[id]/one-cikar`, `/hesabim/siparisler` | Girişli alan | kapalı |
| `/odeme/[siparis]`, `/odeme/sonuc` | Ödeme ve sonuç | kapalı |
| Kalkan ilan | "Bu ilan artık yayında değil" + benzer ilanlar, HTTP 410 | 410 |
| 404 | Arama kutusu + popüler aramalar | 404 |

## 4. Öne çıkarma ürünleri ve kuralları

**Ürünler** (kod · tür · süre): `vitrin_7` · vitrin · 7 gün, `vitrin_30` · vitrin · 30 gün, `acil_7` · acil · 7 gün, `acil_30` · acil · 30 gün, `ust_tasi` · üste taşı · tek sefer.
Her ürünün **site fiyatı** ve **uygulama fiyatı** (TL, kuruş cinsinden tam sayı), mağaza ürün kimlikleri (iOS/Android) ve açık/kapalı durumu vardır. Fiyatları yalnızca yönetici değiştirir; değişiklik işlem kaydına düşer. Başlangıç fiyatları kullanıcı kararıdır (`YAPILACAKLAR.md`); seed'de her ürün 1 TL deneme fiyatıyla ve "deneme fiyatı" açıklamasıyla gelir; gerçek fiyat girilene kadar yönetim ekranında uyarı görünür.

**Kurallar:**
- Satın alınabilmesi için ilan **yayında** ve alıcı **ilanın sahibi** olmalı. Yönetici elle etkinleştirmede herhangi bir yayındaki ilana uygulayabilir, **kendi ilanına uygulayamaz**.
- Süreli ürün: `bitiş = max(şimdi, mevcut bitiş) + gün`. Üst üste alınan süreler toplanır.
- Üste taşı: `sonÜsteTaşınma = şimdi`. "En yeni" sıralamasının anahtarı `max(yayınTarihi, sonÜsteTaşınma)`.
- Süre dolunca etki kendiliğinden biter (sorgu zamanında `bitiş > şimdi`); zamanlanmış iş gerekmez.
- Satılan/kaldırılan/onaya düşen ilan vitrinde ve acil şeridinde görünmez (yalnızca yayındaki ilanlar sayılır). Süre saklanır; ilan yeniden yayına girerse kalan süre geçerli olur.
- İade (yalnızca yönetici): sipariş `iade edildi` olur; süreli üründe bitiş, siparişin gün sayısı kadar geri çekilir (şimdiden geriye gitmez). Kayıt düşer.

**Görünüm:**
- Ana sayfa vitrini: aktif vitrin ilanlarından en fazla 8, her istekte karışık sıra.
- Arama: aramaya uyan aktif vitrin ilanlarından en fazla 3'ü "Vitrin" etiketiyle en üstte (karışık); altında normal liste kullanıcının sıralamasıyla. Vitrin ilanı normal listede de kendi yerinde görünür (etiketli).
- Acil: ilanda "Acil" etiketi; ana sayfada "Acil satılıklar" şeridi (en fazla 8, en yeni); aramada "sadece acil" filtresi.
- Uygulama: aynı etiketler; Keşfet'in üstünde vitrin şeridi; "İlanlarım"da her ilanın aktif ürünleri ve kalan gün; "Öne çıkar" ekranı.

## 5. Ödeme

**Sipariş:** `kullanıcı, ilan, ürün, kanal (web | ios | android | elle), tutar, durum (bekliyor | ödendi | başarısız | iade edildi | iptal), sağlayıcı referansı (tekil), oluşturma/ödeme/iade zamanı, elle işlemde yapan yönetici`. Ürün **yalnızca** sipariş `ödendi` durumuna geçerken ve aynı işlemin içinde etkinleşir.

**Site — sanal POS adaptörü** (`WebPaymentProvider`):
- `createCheckout(sipariş) → yönlendirme adresi`; `verifyCallback(istek) → { sağlayıcıReferansı, sonuç }`.
- Ödeme sonucu, sağlayıcıdan **sunucuya (API)** imzalı bildirimle gelir; imza doğrulanmadan hiçbir sipariş değişmez. Tarayıcının dönüş sayfası yalnızca durumu gösterir, sonucu belirlemez.
- Aynı bildirim birden çok kez gelirse (tekil sağlayıcı referansı + `bekliyor → ödendi` koşullu güncelleme) ürün bir kez açılır.
- **Deneme sürümü:** `/odeme/deneme` sayfasında "Başarılı öde / Başarısız" düğmeleri; sunucu bildirimi deneme gizli anahtarıyla imzalanır. Yalnızca `PAYMENTS_MODE=dev` iken açıktır; `production` ortamında deneme sağlayıcısı başlamayı reddeder.

**Uygulama — mağaza makbuz adaptörü** (`StoreVerifier`):
- `verify(platform, makbuz) → { mağazaÜrünKimliği, işlemKimliği }`. İşlem kimliği tekildir (aynı makbuz iki kez kullanılamaz).
- **Deneme sürümü:** `dev:<ürünKodu>:<rastgele>` biçimli makbuzları kabul eder; yalnızca `PAYMENTS_MODE=dev`. Expo Go'da gerçek mağaza modülü yoktur; uygulama deneme modunda "Satın al (deneme)" düğmesi gösterir.

**Elle etkinleştirme (havale):** yönetici siparişi `kanal: elle` ile oluşturur ve doğrudan `ödendi` yapar; açıklama alanı (ör. dekont no) zorunludur.

## 6. Google'da görünürlük

- Sayfalar sunucuda üretilir; liste ve ilan sayfaları en fazla 60 sn, ana sayfa ve hazır arama sayfaları en fazla 5 dk bayat kalır.
- Her sayfaya kendi başlığı, açıklaması, asıl adres (canonical) ve TR/EN karşılık bildirimi (hreflang).
- schema.org: ilanlarda `Product` + `Offer` (fiyat, para birimi, stok durumu, konum), `BreadcrumbList`; ekspertiz paketlerinde `Service`; sitede `Organization`, `WebSite` (site içi arama kutusu).
- Paylaşım kartı (Open Graph / Twitter): ilanın ilk fotoğrafı, adı, fiyatı.
- `sitemap.xml`: yayındaki ilanlar (son güncelleme zamanıyla), açık hazır arama sayfaları, hizmet ve yasal sayfalar; TR ve EN. Sunucuya herkese açık, hafif bir `GET /listings/sitemap` (kimlik, slug parçaları, güncelleme zamanı) eklenir.
- `robots.txt`: girişli alan, ödeme ve asistan sonuçları kapalı; site haritası bildirilir.
- Fotoğraflar: sunucu `GET /media/:id?w=400|800|1600` genişliklerini üretir ve diskte önbelleğe alır (izinli genişlikler dışında istek reddedilir); site WebP ve `srcset` kullanır; ilk görsel öncelikli yüklenir.
- İç bağlantılar: ilan → kendi tip/şehir sayfası ve benzerleri; alt bilgide popüler aramalar.
- Çerez izni: yalnızca zorunlu çerezler varsayılan; istatistik aracı seçilene kadar hiçbir izleme betiği yüklenmez. İzin kutusu ve tercih kaydı bu turda hazır.
- Hedef: Lighthouse'ta ana sayfa ve ilan detayı için Performans, SEO, Erişilebilirlik ≥ 90 (mobil).

## 7. Teknik yapı

```
teknemisatiyorum/
  shared/  ortak kurallar + (yeni) tasarım dili: renkler, yazı tipleri, boşluklar
  api/     NestJS sunucu (+ ürün, sipariş, ödeme, site haritası, görsel boyutları)
  mobile/  Expo uygulaması (+ vitrin/acil etiketleri, Öne çıkar ekranı, yönetim: siparişler/fiyatlar)
  web/     (yeni) Next.js sitesi
```

- **Tasarım dili:** renk/yazı/boşluk değerleri `shared`'e taşınır; `mobile/src/theme` bunları yeniden dışa aktarır (ekranlar değişmez), `web` CSS değişkenlerine çevirir. Tek kaynak.
- **Veri:** site kendi veritabanını tutmaz; tüm veri API'den. Sunucu tarafı bileşenler API'yi doğrudan çağırır.
- **Dil:** `[locale]` segmenti; TR öneksiz (ara katman yeniden yazar). Çeviriler `web/src/i18n/{tr,en}.json`; "koda gömülü Türkçe metin yok" ve "sunucu hata anahtarlarının hepsi çevrili" testleri sitede de uygulanır.
- **Sitede giriş (BFF):** tarayıcı yalnızca siteyle konuşur. `/api/auth/*` rota işleyicileri API'nin `/auth/otp`, `/auth/verify`, `/auth/refresh`, `/auth/logout` uçlarına aktarır; erişim ve yenileme anahtarları `HttpOnly; Secure (canlıda); SameSite=Lax; Path=/` çerezlerde durur, JavaScript erişemez. Süresi dolan erişim anahtarı sunucu tarafında yenilenir (tek uçuş). Durum değiştiren her site isteğinde `Origin` denetimi.
- **Gerçek IP:** site, API'ye giden isteklere ziyaretçinin IP'sini `X-Forwarded-For` ile ekler; API `TRUST_PROXY` ayarıyla yalnızca sitenin adresine güvenir (geliştirmede loopback). Böylece giriş kodu sınırları ziyaretçi başına işler.
- **Güvenlik başlıkları:** nonce'lu İçerik Güvenlik Politikası, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`; canlıda HSTS.
- **Geliştirme:** site 3001 portunda. `npm run dev` bayraklarla: `--web` siteyi de açar, `--no-mobile` Metro'yu açmaz (bellek az).

### Sunucuya (API) eklenenler

| Parça | Ayrıntı |
|---|---|
| Veri | `Product`, `Order` tabloları; `Listing.featuredUntil`, `urgentUntil`, `bumpedAt`; migration 0004 |
| Herkese açık | `GET /listings` yanıtında `featured`/`urgent` bayrakları ve `featuredTop` (≤3); `urgent=1` filtresi; `GET /listings/showcase` (vitrin ≤8 + acil ≤8); `GET /listings/sitemap`; `GET /products` (açık ürünler ve kanal fiyatları); `GET /media/:id?w=` |
| Satın alma | `POST /orders` (ilan, ürün, kanal web) → ödeme adresi; `POST /payments/web/callback` (imzalı, herkese açık); `POST /orders/store` (platform, makbuz) → doğrula ve etkinleştir; `GET /me/orders` |
| Yönetim | `GET /admin/orders`, `POST /admin/orders/manual`, `POST /admin/orders/:id/refund`, `PUT /admin/products/:code` — yalnızca `admin` rolü; hepsi işlem kaydına |
| Adaptörler | `WEB_PAYMENT` (deneme/gerçek), `STORE_VERIFIER` (deneme/gerçek); `PAYMENTS_MODE=dev|live` |

## 8. Hata durumları

- **API'ye ulaşılamıyor:** önceden üretilmiş sayfalar sunulmaya devam eder; üretilemeyen sayfada "Şu an ilanlara ulaşılamıyor" durumu. Hiçbir sayfa boş ya da çökmüş görünmez.
- **Ödeme yarıda kaldı / kart reddedildi / sekme kapandı:** sipariş `bekliyor` ya da `başarısız`; ürün açılmaz. Hesabım'da durum ve "tekrar dene". Onay geç gelirse geldiği anda etkinleşir. 24 saat `bekliyor` kalan sipariş `iptal` sayılır (sorgu zamanında).
- **Aynı ürün iki kez:** süre toplanır.
- **Vitrindeki ilan satıldı/kaldırıldı:** görünmez; iade kararı yöneticide.
- **Giriş hataları:** uygulamadaki mesajların aynısı, ziyaretçinin dilinde.
- **Sahte/bozuk ödeme bildirimi, tekrar kullanılan makbuz:** reddedilir, kayda düşer, sipariş değişmez.

## 9. Test

- **API (e2e, her biri önce kırmızı):** ürün kuralları; yalnızca sahibin yayındaki ilanı için sipariş; süre toplama; üste taşı sıralaması; süre dolumu; satılan ilanın vitrinden düşmesi; imzasız/yanlış imzalı bildirimin reddi; aynı bildirimin tek etkinleştirmesi; makbuz tekrar kullanımı; elle etkinleştirmede yetki ve kendi ilanı yasağı; iadenin süreyi geri çekmesi; `PAYMENTS_MODE=live` iken deneme sağlayıcısının başlamaması; görsel genişlik sınırı.
- **Web (birim + bileşen):** slug üretimi ve 301; başlık/açıklama/canonical/hreflang; schema.org çıktısı; site haritası; robots; girişli sayfaların `noindex`; çerez bayrakları; güvenlik başlıkları; çeviri kapsamı; koda gömülü metin yok.
- **Uçtan uca (Playwright, gerçek sunucuya):** ziyaretçi ana sayfadan arayıp ilana gider; satıcı siteye girer, "Vitrin 7 gün"ü deneme ödemesiyle alır; ilan ana sayfa vitrininde ve uygulamada "Vitrin" etiketiyle görünür; uygulamada "Acil 7 gün" deneme mağaza ödemesiyle alınır; yönetici havale siparişi oluşturur ve iade eder. Ekran görüntüleri `docs/web-shots/`.
- **Hız:** Lighthouse (mobil) ana sayfa ve ilan detayı.
- **Sonunda:** bağımsız inceleme; `YAPILACAKLAR.md` üzerinden hatırlatma.

## 10. Kabul kriterleri

1. Site TR ve EN açılır; ana sayfa, arama, hazır arama, ilan detayı, hizmet, usta/kaptan, katılım ve yasal sayfalar gerçek sunucu verisiyle çalışır.
2. İlan sayfasında doğru başlık, açıklama, paylaşım kartı ve schema.org bilgisi vardır; site haritası yeni ilanı içerir, kalkan ilanı içermez; kalkan ilan 410 döner.
3. Satıcı siteye telefonla girer, kendi yayındaki ilanına "Vitrin 7 gün"ü deneme ödemesiyle alır; ilan ana sayfa vitrininde ve arama üstünde etiketli görünür; uygulamada da etiketlidir.
4. Uygulamada "Acil" ve "Üste taşı" deneme mağaza ödemesiyle alınır; etkileri sitede ve uygulamada görünür.
5. Yönetici uygulamadan havale siparişi oluşturur, iade eder, ürün fiyatını değiştirir; hepsi işlem kaydındadır.
6. Sahte ödeme bildirimi ve tekrar kullanılan makbuz reddedilir.
7. Lighthouse mobil: ana sayfa ve ilan detayında Performans, SEO, Erişilebilirlik ≥ 90.
8. Tüm test takımları yeşil; lint hatasız; bağımsız inceleme yapılmış ve bulguları kapatılmış.

## 11. Açık kalan

- Ürün fiyatları (kullanıcı kararı; sistem fiyattan bağımsız).
- İstatistik aracı (canlıya çıkarken).
- Gerçek sanal POS ve mağaza ödemesi (hesaplar açılınca, Aşama 2).
- Alan adı ve canlı sunucu (canlıya çıkış işi).
