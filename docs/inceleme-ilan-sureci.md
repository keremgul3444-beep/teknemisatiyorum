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
