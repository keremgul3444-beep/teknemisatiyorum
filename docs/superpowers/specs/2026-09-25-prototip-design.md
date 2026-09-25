# teknemisatıyorum.com: Tıklanabilir Prototip Tasarımı

- **Tarih:** 2026-09-25
- **Durum:** Taslak, kullanıcı onayı bekliyor

## 1. Amaç

teknemisatıyorum.com, bir teknenin bütün yaşam döngüsünü (alım-satım, ekspertiz, bakım-onarım, kaptan kiralama, broker hizmeti) tek bir mobil uygulamada toplayan bir platform.

Bu aşamanın çıktısı **tıklanabilir, görsel olarak bitmiş bir prototip**. Bütün sayfalar gerçek bir uygulama gibi gezilebilecek ve gerçekçi sahte verilerle dolu olacak. Prototip gerçek teknolojiyle (Expo) yazılacak. Böylece sonraki aşamada sunucu, ödeme ve kimlik doğrulama, sahte veri katmanının yerine takılacak. Uygulama sıfırdan yeniden yazılmayacak.

**Başarı ölçütü:** Kullanıcı prototipi telefonunda açar ve bölüm 6'daki bütün demo akışlarını baştan sona, takılmadan tıklayarak tamamlar. Uygulamada ölü düğme ya da boş ekran yoktur.

## 2. Alınmış kararlar

| Konu | Karar |
|---|---|
| İş modeli | Karma. Ücretsiz ilan + broker hizmeti + ekspertiz + usta/servis pazar yeri + kaptan kiralama |
| Para akışı | Tekne satışında para platform dışında el değiştirir (noter/banka). Usta ve kaptan hizmetleri uygulama içinden, lisanslı ödeme kuruluşu üzerinden güvenli ödemeyle ödenir, platform komisyon alır. Broker ve ekspertizi doğrudan platform faturalar |
| Platform | Önce mobil (iOS + Android). Yönetim paneli web'de. Google'da görünecek web vitrini sonraki aşamada |
| Dil | Türkçe + İngilizce. Altyapı çok dilli kurulur. Para birimi TL/EUR/USD gösterilir |
| Hesap yapısı | Tek hesap, birden çok rol. Hizmet profili hesaba eklenir. Kurumsal hesap ilk sürümde var |
| Doğrulama | Seviye 0 misafir → 1 telefon + e-posta → 2 kimlik → 3 profesyonel belge + elle onay. Tekne sahipliği doğrulaması ayrı rozet olarak |
| Gizlilik | Telefon numarası gizli. Tüm iletişim uygulama içi mesajla. Kullanıcı isterse numarasını tek bir karşı tarafa açar |
| Tasarım dili | "Kıyı Sıcak" (bölüm 4) |
| Teknoloji | TypeScript. Mobil ve web: Expo (React Native + Expo Router). Sonraki aşamada NestJS + PostgreSQL (PostGIS, pgvector) |

## 3. Kapsam

### Prototipte olanlar
- Bölüm 5'teki bütün ekranlar, gezilebilir halde
- Sahte veri katmanı:
  - 25 tekne ilanı
  - 12 usta/servis
  - 8 kaptan
  - 3 eksper paketi
  - 2 kurumsal firma
  - Örnek sohbetler, işler, Tekne Karnesi kayıtları
- Akıllı Asistan'ın **kural tabanlı sahte hali**. Yazılan metinden boy, yıl, fiyat ve ekipman anahtar kelimeleri çıkarılır, sahte ilanlar bu filtreyle süzülür. Gerçek yapay zeka sonraki aşamada eklenecek, ama arayüz aynı kalacak.
- TR/EN dil değiştirme, bütün metinler çeviri dosyalarından gelir
- Durum değiştiren akışlar hafızada simüle edilir. Örneğin teklif kabul edilince iş "devam ediyor" durumuna geçer. Uygulama yeniden açılınca demo verisi başa döner.

### Prototipte olmayanlar (sonraki aşamalar)
- Gerçek sunucu, veritabanı, dosya yükleme
- Gerçek SMS, kimlik doğrulama, ödeme, fatura
- Gerçek yapay zeka modeli
- Bildirimler (push)
- Google'da görünen web vitrini (SEO)
- Hukuki araştırma ve metinler: KVKK, e-ticaret/aracı hizmet sağlayıcı yükümlülükleri, ödeme mevzuatı, veri yerleşimi. Prototipte bu metinlerin yerinde "taslak metin" etiketli yer tutucular olur.

## 4. Tasarım dili: Kıyı Sıcak

| Öğe | Değer |
|---|---|
| Zemin | `#F4EFE6` (kum) |
| Kart | `#FFFCF6` |
| Ana renk / vurgu | `#0F6E68` (petrol yeşili) |
| Metin | `#1D2B2A` |
| İkincil metin | `#6B736B` |
| Çip / yüzey | `#E7DFD0` |
| Çizgi | `#E2D9C8` |
| Başlık fontu | Space Grotesk (500/700) |
| Metin fontu | Inter (400/600/700) |
| Köşe yarıçapı | Kart 18, düğme 10–12, çip 14 |

- Bütün renk, boşluk ve yazı değerleri tek bir tema dosyasından gelir. Ekranlara sabit değer yazılmaz.
- Durum renkleri: başarı `#2E7D4F`, uyarı `#C98A1B`, hata `#B3261E`. Rozet: beyaz zemin üzerinde `#1D2B2A` metin, başında ✓ işareti.
- Karanlık mod bu aşamada yok.

## 5. Sayfa haritası

Alt menü: **Keşfet · Hizmetler · ＋ Ekle · Mesajlar · Profil**

1. **Giriş ve kayıt:**
   - Açılış, 3 tanıtım ekranı
   - Telefonla giriş + SMS kodu
   - Google/Apple girişi
   - Kimlik doğrulama (Seviye 2)
   - Profesyonel belge yükleme (Seviye 3)
   - KVKK aydınlatma ve izin ekranları
2. **Keşfet:**
   - Ana sayfa (Akıllı Asistan, kategoriler, öneriler)
   - Asistan sonuç ekranı: anlaşılan filtre etiketleri, eşleşenler, yakın sonuçlar, "aramayı kaydet"
   - İlan listesi: filtreler, liste ve harita görünümü
   - İlan detayı: galeri, özellikler, rozetler, karne özeti, satıcı kartı; mesaj, ekspertiz iste, favori, paylaş
   - Değerleme aracı
   - Tersine ilan / kayıtlı aramalar
3. **Hizmetler:**
   - Hizmet ana sayfası
   - Usta/Servis: kategoriler, liste, profil, iş talebi formu, teklif karşılaştırma
   - Ekspertiz: paket seçimi, randevu, örnek rapor
   - Kaptan: tarih seçimi (günlük/haftalık), liste, profil, rezervasyon
   - Broker: başvuru ve süreç takibi (değerleme → çekim → yayın → teklifler → devir)
   - Güvenli ödeme (simülasyon)
   - İş takibi: talep → teklif → onay → devam → tamam → değerlendirme
4. **＋ Ekle:**
   - İlan verme sihirbazı: fotoğraf, özellikler, fiyat, sahiplik belgesi, önizleme
   - Hizmet talebi aç
   - Tekne ekle
5. **Mesajlar:**
   - Sohbet listesi
   - Sohbet ekranı: konu olan ilan veya iş en üstte, "numaramı paylaş" düğmesi
6. **Profil:**
   - Teknelerim + Tekne Karnesi (zaman çizelgesi, belgeler, paylaşım linki)
   - Devir asistanı
   - İlanlarım, favoriler, kayıtlı aramalar, işlerim, ödemeler
   - Hizmet veren paneli: gelen işler, takvim, kazanç, belgeler
   - Kurumsal panel: firma sayfası, personel, toplu ilan
   - Ayarlar: dil, bildirimler, gizlilik, cihazlar, hesabı sil
7. **Yönetim paneli** (web düzeni):
   - Genel bakış
   - İlan onayları, belge onayları
   - Broker dosyaları, ekspertiz raporları
   - Kullanıcılar, ödemeler
   - İşlem kayıtları

**Demo rol değiştirici:** Profil > Ayarlar'da, prototipe özel bir "Demo: rol değiştir" seçeneği olur. Seçenekler: bireysel, usta, kaptan, kurumsal, yönetici. Böylece tek hesapla bütün paneller gezilebilir.

## 6. Demo akışları (kabul testleri)

1. **Asistanla arama:** Asistana "12 metreye kadar jeneratörlü brandalı 2015 sonrası" yazılır. Sonuç ekranında filtre etiketleri ve eşleşen ilanlar görünür. Bir ilan açılır, karne özetine bakılır, satıcıya mesaj atılır.
2. **Aramayı talebe çevirme:** Sonuç çıkmayan bir aramada "aramayı kaydet" düğmesine basılır, arama kayıtlı aramalarda görünür.
3. **İlan verme:** Sihirbaz baştan sona doldurulur, önizleme yapılır, yayınlanır, "İlanlarım"da "onay bekliyor" olarak görünür.
4. **Usta işi:** İş talebi açılır (motor, fotoğraf), 3 teklif karşılaştırılır, biri kabul edilir. Güvenli ödeme simülasyonu yapılır, iş tamamlanır, değerlendirme yapılır ve kayıt Tekne Karnesi'ne düşer.
5. **Kaptan kiralama:** Haftalık tarih seçilir, kaptan profili incelenir (belgeler), rezervasyon ve ödeme simülasyonu yapılır.
6. **Ekspertiz:** Bir ilandan "ekspertiz iste" ile paket ve randevu seçilir, örnek rapor görüntülenir.
7. **Broker:** "Teknemi siz satın" başvurusu yapılır, süreç takibi ekranında adımlar görünür.
8. **Değerleme:** Tekne bilgileri girilir, fiyat aralığı gösterilir.
9. **Roller:** Demo rol değiştiriciyle usta paneline, kurumsal panele ve yönetim paneline geçilir. Yönetim panelinde bir ilan onaylanır.
10. **Dil:** Dil İngilizceye çevrilince bütün ekranlar İngilizce görünür.

## 7. Teknik yapı

- **Expo + Expo Router:** dosya tabanlı sayfa yapısı. Aynı kod iOS, Android ve web'de çalışır.
- **Ekran ve veri ayrımı:** Ekranlar veriye doğrudan erişmez, **servis arayüzleri** üzerinden erişir: `listingsService`, `servicesService`, `messagesService` vb. Prototipte bu arayüzleri sahte veri uygulaması karşılar. Gerçek API geldiğinde sadece uygulama değişir, ekranlar değişmez.
- **Klasör yapısı (taslak):**
  - `app/`: sayfalar (routes)
  - `src/components/`: ortak bileşenler
  - `src/theme/`: tasarım değerleri
  - `src/services/`: arayüzler + mock uygulamaları
  - `src/mocks/`: sahte veri
  - `src/i18n/`: tr.json, en.json
  - `src/features/assistant/`: kural tabanlı sorgu ayrıştırıcı
- **Test:**
  - Asistan ayrıştırıcısı ve servis mock'ları için birim testleri
  - Bölüm 6'daki demo akışları elle kontrol listesi olarak yürütülür
- **Paylaşım:**
  - Telefonda: Expo Go ile açılır
  - Başkalarına göstermek için: web derlemesi link olarak paylaşılabilir

## 8. Sonraki aşamalar (bu belgenin dışında)

1. Hukuki ve güvenlik araştırması: KVKK, 6563 sayılı Kanun / aracı hizmet sağlayıcı, ETBİS, ödeme kuruluşu seçimi, veri yerleşimi (TR ya da AB), kaptan/usta hukuki statüsü, mağaza kuralları. Sonuçlar avukat onayına gidecek.
2. Arka uç: NestJS + PostgreSQL, gerçek kimlik doğrulama ve yetkilendirme, işlem kayıtları
3. Güvenli ödeme entegrasyonu
4. Gerçek yapay zeka araması (pgvector + dil modeli; sadece veritabanındaki gerçek ilanları döndürür)
5. Web vitrini (SEO)
6. Ek modüller: sigorta/kredi ortaklıkları, marina/kışlama, yedek parça, mürettebat
