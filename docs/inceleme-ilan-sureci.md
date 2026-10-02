# İlan süreci ayrıntılı inceleme (2026-10-02)

Kapsam: ilan verme, onay/red, düzenleme, satıldı, mesajlaşma, site ilan sayfası ve sunucu güvenliği.
Her madde kodda izlenerek doğrulandı (dosya:satır). "Şüpheli" işaretli olanlar çalışırken denenmedi.

## A. Önce kapatılması gereken güvenlik açıkları (sunucu)

1. **Moderatör ilanın çoğunu görmeden onaylıyor.** Onay kuyruğu yalnızca başlık, yıl, fiyat, sahip ve fotoğrafları döndürüyor (`api/src/modules/admin/admin.module.ts:58-60`). Açıklama (4000 karakter), konum, motor, donanım ve yeni alanlar hiç gösterilmiyor. Açıklamaya yazılan "WhatsApp 05xx, kaporayı IBAN TR.. hesabına" metni görülmeden onaylanır.
   Çözüm: kuyrukta tam ilan görünümü ve son onaylı sürümle fark.
2. **Moderatör bakarken ilan değiştirilebiliyor, onay yeni içeriği yayınlıyor.** Bekleyen ilan düzenlenince bekler durumda kalıyor (`listings.controller.ts:133-136`). Karar yalnızca `{ id, status: 'pending' }` ile yazılıyor (`admin.module.ts:73-74`), sürüm kontrolü yok.
   Çözüm: karara `updatedAt` eklenir, eşleşmezse karar reddedilir.
3. **Satıldı ilana onaysız fotoğraf eklenebiliyor.** Fotoğraf ucu yalnızca yayında ya da reddedilmiş ilanı yeniden onaya düşürüyor (`listings.controller.ts:155`). Satıldı ilanlar herkese açık kaldığı için eklenen görsel denetimsiz yayına çıkıyor.
   Çözüm: `sold` ve `removed` durumunda reddet (düzenleme ucundaki gibi, `:128`).
4. **Belge rozetleri, ilan başka bir tekneye çevrilse de kalıyor.** Ruhsat onayı `sahiplik`/`belge` rozeti ekliyor (`admin.module.ts:103-108`), düzenleme rozetlere dokunmuyor (`listings.controller.ts:137`). Gerçek tekneyle rozet alınıp marka, model ve yıl değiştirilebilir.
   Çözüm: kimlik alanları (marka, model, yıl, boy, tekne) değişince rozetler düşer.
5. **Yayındaki ilan kaldırılamıyor, kullanıcı engellenemiyor, ilan şikayet edilemiyor.**
   - Moderatör kararı yalnızca bekleyen ilana uygulanıyor.
   - Kullanıcı modelinde askıya alma alanı yok (`auth.guard.ts:45` yalnızca silinmiş hesabı denetliyor).
   - Şikayet ucu da düğmesi de yok.

## B. Uygulamada kullanıcıyı yanıltan hatalar

6. **Reddedilen ilan "Onay bekliyor" görünüyor, red nedeni hiç gösterilmiyor.** Durum eşlemesi yalnızca yayında ve satıldıyı tanıyor (`mobile/src/services/api/mappers.ts:39`). `rejectReason` hiçbir ekranda kullanılmıyor. Satıcı sonsuza kadar bekler.
7. **Moderatör hangi red nedenini seçerse seçsin sunucuya hep "kurallar" gidiyor.** Üç neden düğmesi de nedeni atıyor (`components/AdminBits.tsx:64`), istek sabit `reason: 'rules'` ile çıkıyor (`services/actions.ts:209`).
8. **Her satıcıda "Doğrulanmış" rozeti var.** Rozet koşulsuz basılıyor (`app/ilan/[id].tsx:169`). Alıcıya yanlış güven veriyor.
9. **Satıcı numarasını paylaşınca alıcı göremiyor.** `otherPhone` eşleniyor ama hiçbir ekranda kullanılmıyor.
10. **İlan düzenleme, fiyat değiştirme ve yayından kaldırma ekranı yok.** Sunucu düzenleme, silme ve redden sonra yeniden gönderme uçlarını destekliyor, uygulama kullanmıyor. Satıcı fiyat indiremiyor, reddedilen ilanı düzeltemiyor.
11. **Yarıda kalan yayın sorunları:**
    - Sonradan silinen fotoğraf ilanda kalıyor: sunucu yalnızca ekliyor (`listings.controller.ts:146-158`).
    - Uygulama kapanırsa sunucudaki yarım taslak sahipsiz kalıyor, sonraki denemede ikinci ilan açılıyor (`features/publishListing.ts:20`).
12. **Klavye alt alanları örtüyor.** `Screen` klavyeden kaçınmıyor (`components/Screen.tsx:13`). Bu iOS'ta fiyat, açıklama ve seri no alanlarını etkiliyor.
13. **Kimlik kapısı yalnızca ekran açılırken çalışıyor.** Girişten dönen kullanıcı beş adımı doldurup kimlik doğrulamasıyla ancak "Yayınla"da karşılaşıyor.
14. **Ekran okuyucu ve erişilebilirlik eksikleri.**
    - "Tekne tipi *" başlığı "yıldız" diye okunuyor.
    - Belge kutusunun rolü yok.
    - Kapak fotoğrafı ekran okuyucuya kapak olarak bildirilmiyor.

## C. Site (web)

15. **Görüntülenme sayıları şişiyor.** Site ara katmanı her `/ilan/*` isteğinde ilanı API'den çekiyor (`web/src/proxy.ts:74-77`), API de her okumada sayaç artırıyor (`listings.controller.ts:99`). Botlar, yenilemeler ve satıcının kendisi de sayılıyor. Satıcı istatistikleri bu yüzden yanlış.
16. **Satıldı ilanda "Mesaj gönder" ve "Ekspertiz iste" düğmeleri açık kalıyor** (`ilan/[slug]/page.tsx:92-95`). "Ekspertiz iste" ilan kimliğini de taşımıyor.
17. **Siteden satıcıya ulaşılamıyor.** Düğme yalnızca uygulama bağlantısı (`components/bits.tsx:89-96`). Masaüstünde ya da uygulaması olmayan telefonda hiçbir şey olmuyor.
18. **Fotoğraflar büyütülemiyor.** 400 piksellik küçük resimler, tıklanmıyor (`page.tsx:65-68`).
19. **Sitede kapora uyarısı ve satıcı kartı yok.** Uygulamada var.
20. **Karne başlığıyla platform metni taklit edilebiliyor.** Kullanıcı başlığı `i18n:` ile başlarsa site onu çeviri anahtarı sayıyor (`page.tsx:110`, `boats.module.ts:61`). Örneğin "Broker güvencesi" yazdırılabiliyor; geliştirme ortamında sayfa 500 hatası veriyor.
21. **Telefonda fiyat ve iletişim, 19 küçük resmin altında kalıyor** (`page.tsx:58-70`). 332 pikselden dar ekranda yatay taşma da var.

## D. Orta öncelik

- **Fiyat oyunu.** Önce artırıp sonra indirerek sahte "fiyat düştü" rozeti ve favorileyenlere bildirim alınabiliyor (`listing.view.ts:23-26`). 1 TL yem fiyat da onaysız yayına çıkıyor.
- **Karne kayıtları moderasyonsuz yayında görünüyor** (`listing.view.ts:50`).
- **Medya erişimi ve kota.** Yüklenen her herkese açık görsel, ilana bağlı olmasa da sonsuza kadar erişilebilir (`media.service.ts:62-68`). Kullanıcı başına dosya, bayt ve taslak kotası yok.
- **Arama tüm yayındaki ilanları her istekte belleğe alıyor** (`listings.service.ts:79`). Binlerce ilanda yavaşlar.
- **Mesajlaşma korumaları eksik.** Mesajlarda spam sınırı, engelleme ve IBAN/telefon uyarısı yok. "Telefonum görünsün" açıksa, mesaj atmadan sohbet açarak numara toplanabiliyor.
- **Moderatörün özel belge (kimlik, ruhsat) görüntülemesi denetim kaydına yazılmıyor** (`media.service.ts:72-77`).

## E. Yeni alanların eksik kaldığı yerler

Motor saati, bayrak, takas ve pazarlık şu an yalnızca ilan sayfasında görünüyor. Eksik oldukları yerler:
- arama ve filtreler (`shared/src/filter.ts`)
- karşılaştırma (`features/compare.ts`)
- ilan kartları
- site yapısal verisi (`web/src/lib/seo.ts`)
- moderasyon kuyruğu

## Bu turda düzeltilenler (ilan verme ekranı)

- Taslak fotoğraf ve belgeleri sistemin silebileceği önbellekten kalıcı klasöre kopyalanıyor (`features/draftFiles.ts`). Geri yüklemede kaybolan dosyalar düşüyor ve sayısı söyleniyor.
- Hesap değişince taslak karışmıyor. Yükleme bitmeden kayıt yapılmıyor; taslağı olmayan hesaba önceki form taşınmıyor.
- "Sil ve baştan başla" artık onay istiyor.
- 20 fotoğraf yüklenirken "Fotoğraflar yükleniyor: 3/20" gösteriliyor, yayın sürerken Geri kapalı.
- Önizlemeden önce tüm adımlar yeniden denetleniyor, hatalı adıma dönülüyor.
- Motor seri no fotoğrafı yalnızca ruhsatla birlikte gönderilebiliyor; önceden tek başına eklenince sessizce kayboluyordu.
- Seri no etiketi sunucu sınırıyla uyumlu: "son 4–6 hane".
- Fotoğraf sınırı (20) sunucu ve uygulamada tek kaynaktan geliyor.
- Satır sonları: önceki commit Windows satır sonlu (CRLF) 6 dosyayı LF'ye çevirmişti, geri alındı.

## Güvenlik paketi ile kapatılanlar (2026-10-02)

- A1: Onay kuyruğu ilanın tamamını taşıyor (açıklama, konum, özellikler, yeni alanlar, satıcının kimlik seviyesi); uygulamadaki moderasyon kartında görünüyor.
- A2: Karar `version` (kuyruktaki `updatedAt`) ister; satıcı arada değiştirdiyse 409 `LISTING_CHANGED`, sürümsüz karar 400 `VERSION_REQUIRED`. Uygulama sürümü gönderiyor, hata olursa kuyruğu yeniliyor.
- A3: Satılmış ya da kaldırılmış ilana fotoğraf eklenemiyor (409 `LISTING_CLOSED`).
- A4: Marka, model, yıl, boy ya da bağlı tekne değişince `sahiplik`, `belge`, `ekspertizli` rozetleri düşüyor (`broker` kalıyor).
- B6, B7: Reddedilen ilan uygulamada "Reddedildi" sekmesinde, gerekçesiyle; ilan sayfasında satıcıya kırmızı not. Moderatörün seçtiği gerekçe sunucuya gidiyor.
- B8: "Doğrulanmış" rozeti yalnızca kimliği doğrulanmış (seviye 2+) satıcıda; API `seller.verified` döndürüyor.
- C15: Görüntülenme: site ara katmanı ve sayfa önbelleği `X-Tms-No-Count` ile saymıyor; sitede gerçek ziyaret tarayıcıdan `POST /api/views` → `POST /listings/:id/view` ile bir kez sayılıyor. Aynı kişi (hesap ya da IP) 30 dakika içinde tekrar sayılmıyor, satıcı hiç sayılmıyor.
- C16: Satılmış ilanda uygulamada ve sitede mesaj/ekspertiz düğmeleri yerine "Bu tekne satıldı"; sitedeki ekspertiz bağlantısı ilan kimliğini taşıyor.
- C20: Karne başlığı ve yazar adı `i18n:` ile başlayamıyor; uygulama ve site yalnızca `i18n:logbook.` anahtarlarını çeviriyor.

## Şikayet ve yaptırım paketi ile kapatılanlar (2026-10-02)

- A5: İlan bildirme (`POST /listings/:id/report`, giriş yapmış alıcı, kişi başına ilan başına bir kez, günde en fazla 10). Gerekçeler: dolandırıcılık şüphesi, yanlış bilgi/fotoğraf, satılmış, uygunsuz içerik, diğer. Bildirim ilanı kendiliğinden kaldırmaz (rakiplerin birkaç hesapla ilan düşürmesi engellenir).
- Moderatör: `GET /admin/reports` (ilana göre gruplu, en çok bildirilen önce), `POST /admin/listings/:id/takedown` (yayındaki, bekleyen ya da satılmış ilanı gerekçeyle kaldırır, sahibine bildirim), `POST /admin/listings/:id/reports/dismiss`. Uygulamada Yönetim > Bildirimler sayfası; kaldırma ve askıya alma ikinci adımla onaylanır.
- Hesap askıya alma: `POST /admin/users/:id/suspend|unsuspend`. Askıda oturumlar kapanır, giriş ve anahtar yenileme engellenir (`ACCOUNT_SUSPENDED`), yayındaki ve bekleyen ilanlar `account_suspended` gerekçesiyle kalkar. Ekip üyesi ve kişinin kendisi askıya alınamaz. Askı kaldırılınca ilanlar kendiliğinden geri gelmez. Yönetim > Kullanıcılar'da askıdaki hesap işaretli, "Askıyı kaldır" var.
- Satıcı: moderatörün kaldırdığı ilan İlanlarım > Kaldırıldı'da gerekçesiyle görünür (kendi kaldırdıkları gizli kalır).
- Site: yayındaki ilanda "İlanı bildir (uygulamada)" bağlantısı.
- KVKK dışa aktarımına kişinin gönderdiği bildirimler ve askı kaydı eklendi.
- Veritabanı: `0009_reports_suspension` (ListingReport tablosu, User.suspendedAt/suspendReason, Listing.removedReason).

Kalan: B9–B14, C17–C19, C21, D ve E maddeleri. Sitede bildirme şimdilik uygulamaya yönlendiriyor; siteden doğrudan bildirme için site girişi gerekir.

## Satıcı ilan yönetimi paketi ile kapatılanlar (2026-10-02)

- B10: İlan düzenleme. Sihirbazın düzenleme modu (`/ilan-ver?id=…`): bilgiler, donanım, fiyat, yeni alanlar ve fotoğraflar (ekle, sırala, kapak, sil). Yalnızca değişen alanlar gönderilir; yalnızca fiyat değişirse ilan yayında kalır, diğer değişikliklerde önizlemede "onaya gider, onaylanana kadar görünmez" uyarısı var.
- İlanlarım'da her ilan için Düzenle, hızlı Fiyat (onaya düşmez) ve Yayından kaldır (ikinci adımla onay). Reddedilen ilanda "Düzelt ve yeniden gönder"; kaydedince yeniden onaya gider.
- B11: `PUT /listings/:id/photos` fotoğrafların tam listesini ve sırasını ayarlar. Yarıda kalan yayının yeniden denemesinde sonradan silinen fotoğraf ilanda kalmıyor, kapak değişikliği işleniyor. Sunucuda açılan taslağın kimliği yerel taslağa yazılıyor; uygulama kapanıp açılırsa aynı taslaktan sürdürülüyor (ikinci ilan açılmıyor). Sunucudaki yarım taslaklar İlanlarım'da gösterilmiyor; "Sil ve baştan başla" onları da siliyor.
- B12: `Screen` klavyeden kaçınıyor (iOS).
- B13: Kimliği doğrulanmamış kullanıcı ilan formunun başında "Kimliğini doğrula" uyarısı görüyor (yayınlarken sürpriz yok).

Kalan: B9 tamamlandı; B14 (erişilebilirlik ayrıntıları), C17–C19, C21, D ve E maddeleri.

## Site paketi ile kapatılanlar (2026-10-02)

- C17: Siteden satıcıya mesaj (`/api/messages` → sohbet aç + mesaj; giriş yoksa girişe yönlendirir, yazılan metin sekmede saklanır ve dönünce geri gelir). Hesabım > Mesajlar: gelen kutusu ve sohbet sayfası, yanıt kutusu; satıcı numarasını paylaştıysa arama bağlantısı. Favoriye ekle/çıkar (`/api/favorites`).
- C18: Galeri: kapak + tek satırlık kaydırılabilir küçük resim şeridi, tam ekran görüntüleyici (ok tuşları, Esc, ileri/geri), sıralı alt metinler ("… fotoğraf 3/12"); JavaScript yoksa küçük resimler büyük fotoğrafa bağlantı.
- C19: Satıcı kartı (bireysel satıcıda kısaltılmış ad "Deniz Y.", üyelik yılı, "Kimliği doğrulanmış"), kapora uyarısı, ilanı bildirme bağlantısı.
- C21: Telefonda fiyat ve iletişim küçük resimlerin altında kalmıyor; 332 px altı taşma giderildi.
- Karne kaydında "doğrulanmış" işareti ve "Tekne Karnesi nedir?" bağlantısı.
- Yapısal veri: model, productID/sku, kategori, ölçülü özellikler (boy MTR, motor saati HUR, kabin, motor, bayrak, takas, pazarlık), priceValidUntil.
- Hesabım > İlanlarım: red ve kaldırma gerekçeleri, satılmış/kaldırılmış için doğru not; Öne çıkar sayfası ürünler yüklenemezse boş ızgara yerine uyarı.
- Kısa paylaşım adresi (`/ilan/<kimlik>`) kalkan ilanda da 410.
- BFF: `relay` artık GET/PUT/DELETE ve aynı istekte yenilenmiş anahtarla ikinci çağrıyı destekliyor.

## Önerilen sıra

1. **Güvenlik paketi:**
   - A1–A4
   - B6–B8
   - C15, C16, C20
2. **Şikayet ve yaptırım:** şikayet düğmesi ve kuyruğu, moderatörün yayındaki ilanı kaldırması, kullanıcı askıya alma.
3. **Satıcı yönetimi:**
   - Sihirbazın düzenleme modu (fiyat, metin, fotoğraf, yeni alanlar) ve yayından kaldırma.
   - Fotoğraf listesini tam ayarlayan uç (`PUT /listings/:id/photos`), yarım yayını sürdürme.
   - Klavye düzeltmesi.
4. **Site:** siteden iletişim, galeri, güvenlik uyarısı ve satıcı kartı, telefonda düzen.
5. **Arama:** yeni alanlarla filtre, karşılaştırma ve kart.

## Arama paketi ile kapatılanlar (2026-10-02)

- E: Motor saati, bayrak, takas ve pazarlık aramaya girdi. Ortak sorgu şeması `maxEngineHours`, `flag`, `tradeIn`, `negotiable` alanlarını taşıyor; asistan "1000 saatin altında", "türk bayraklı", "takasa açık", "pazarlıklı" gibi ifadeleri anlıyor (Claude modu da aynı alanları dolduruyor). Motor saati girilmemiş ilan, motor saati sınırlı aramada eşleşmiyor.
- Uygulamada filtre sayfasına en az/en çok fiyat, en çok motor saati, bayrak ve satış koşulları eklendi; karşılaştırmada motor saati (az olan iyi), bayrak ve koşullar satırları var. Sitede filtrelerde en az fiyat, en çok yıl, motor saati, bayrak, takas ve pazarlık (`?maxSaat=&bayrak=tr|yabanci&takas=1&pazarlik=1`).
- D (arama belleği): Arama artık her istekte tam ilanları yüklemiyor. Önce yalnızca eşleştirme ve sıralama alanları okunuyor (yeni alanlar SQL tarafında süzülüyor), tam ilan yalnızca gösterilecek sayfa ve öne çıkanlar için yükleniyor. Asistanın tam eşleşme listesi 50 ile sınırlı.

## D paketi ve düşük öncelikliler ile kapatılanlar (2026-10-02)

- Fiyat oyunu: "fiyat düştü" artık son değişiklikten önceki 60 günün en düşük fiyatına göre ölçülüyor; artırıp indirmek rozet ve bildirim vermiyor. Yalnızca fiyat değişikliği, yarıdan aşağı ya da bir buçuk kattan yukarıysa yeniden onaya düşüyor (1 TL yem fiyat). Haftada en fazla 3 fiyat değişikliği (`PRICE_CHANGE_LIMIT`).
- Karne: onaydan sonra yazılan doğrulanmamış kayıt, bir sonraki onaya kadar yalnızca sahibine görünüyor.
- Medya: herkese açık dosya yalnızca kaldırılmamış bir ilanın fotoğrafıysa ya da 24 saatten yeniyse açılıyor. Bir haftalık bağlanmamış dosyalar günlük temizlikte siliniyor. Kullanıcı başına günde 100 yükleme ve 300 MB alan, en fazla 50 megapiksel görsel, en fazla 5 açık taslak. Herkese açık görsel önbelleği 1 saat.
- Moderatörün başkasının korumalı belgesini açması denetim kaydına yazılıyor. İmzalı PDF indirme olarak veriliyor (`attachment`, `nosniff`, `sandbox`).
- Mesajlaşma (migration `0010_messaging_guard`): engelleme ve engeli kaldırma (uygulama ve site), günde 20 yeni sohbet, saatte 60 mesaj, yanıt gelmeden en fazla 5 mesaj. "Telefonum görünsün" numarayı yalnızca sohbete yazmış kişiye açıyor. IBAN, kapora ve havale geçen gelen mesajın altında uyarı çıkıyor (`shared/src/safety.ts`).
- L1: Yeniden gönderilen ilanda moderatör önceki red gerekçesini görüyor. Karar kaydı sürümü, fiyatı ve gerekçeyi tutuyor.
- L3: Fotoğraf ekleme, ilan satırı kilitliyken tek işlemde yapılıyor; eşzamanlı isteklerle 20 sınırı aşılamıyor.
- L4: "Ekspertizli" rozeti ve karne kaydı yalnızca ilan sahibinin yaptırdığı ekspertizden geliyor; rozet için en az 60 puan gerekiyor.
- L5: Düzenleme, fotoğraf değişikliği, satıldı ve yayından kaldırma denetim kaydına yazılıyor.
- L8: İlanın firma bağı `companyId: null` ile kaldırılabiliyor.
- Açık kalanlar: kopya veya çalıntı fotoğraf tespiti, ilan süresi ve yenileme.

## B14 erişilebilirlik ile kapatılanlar (2026-10-02)

- Zorunlu alanda ekran okuyucu yıldızı ve görünen etiketi ayrıca okumuyor; kutunun adı "Marka, zorunlu", hata ya da açıklama ipucu olarak okunuyor.
- Belge yükleme kutusu düğme olarak ve durumuyla okunuyor ("Ruhsat, Eklendi").
- Sihirbazda belge, gönderimden önce "İncelemede" değil "Eklendi" görünüyor; inceleme gönderimle başlıyor.
- Fotoğraflar "Fotoğraf 1 / 5, kapak" diye okunuyor.
