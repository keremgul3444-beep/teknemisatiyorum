# Yapılacaklar — ertelenen işler ve kararlar

Sonraya bırakılan her iş burada durur. Bir iş bitince satırını silip commit mesajında an.
Kullanıcı hatırlatma istedi: her büyük aşama sonunda bu liste gözden geçirilir.

## Senin (Kerem/işletme) yapman gerekenler — ben yapamam
- [ ] Bulut depolama hesabı (Cloudflare R2 önerilir: çıkış trafiği ücretsiz) ve kova; anahtarları yalnızca sunucudaki `api/.env`'e yaz (`STORAGE_DRIVER=s3`, `S3_*`, `BACKUP_OFFSITE=1`). Kod hazır.
- [ ] Avukat onayı: KVKK aydınlatma metni, açık rıza metinleri, kullanım koşulları, çerez politikası (sitede "taslak" ibaresiyle duruyor)
- [ ] VERBİS kaydı; ticari ileti için İYS kaydı
- [ ] Sanal POS anlaşması (iyzico, PayTR vb.) — şirket evrakı, vergi levhası
- [ ] Apple Developer hesabı (~99$/yıl) ve Google Play Console hesabı (~25$ tek sefer)
- [ ] Claude API anahtarı (Akıllı Asistan şu an kural tabanlı yedekle çalışıyor)
- [ ] Google Search Console kaydı (site canlıya çıkınca)
- [ ] Sohbete yapıştırılan Expo token'larını expo.dev → Access Tokens'tan sil
- [ ] Broker komisyon oranı ve öne çıkarma fiyatları kararı (piyasa araştırmasıyla)
- [ ] Şirket unvanı/adresi ve gerçek iletişim e-postası (sitede şimdilik iletisim@teknemisatiyorum.com yazıyor, alan adı alınınca açılmalı)

## Web sitesi
- [ ] Aşama 2 ödeme: gerçek sanal POS ve gerçek Apple/Google ödemesi (hesaplar açılınca, deneme modunun yerine takılır)
- [ ] Siteden ilan verme, kimlik doğrulama, fotoğraf yükleme (C seçeneği)
- [ ] Web yönetim paneli (/yonetim)
- [ ] Firma paneli (/firma)
- [ ] Blog / içerik yazıları (SEO için değerli, ayrı içerik işi)
- [ ] İstatistik aracı seçimi (Google Analytics ya da gizlilik dostu alternatif)
- [ ] Canlı sunucuda hız ölçümünü (Lighthouse) tekrarla; yerel ölçüm: ana sayfa 96, ilan 92
- [ ] Uygulamanın "Öne çıkar" ekranını uçtan uca tarayıcı testiyle dene (bu turda bellek yetersizliğinden uygulama önizlemesi açılmadı; aynı sunucu ucu kabul testinde denendi)

## Uygulama ve arka uç
- [ ] API uçtan uca testleri yerelde çalıştırılmalı (`cd api; npx jest --runInBand`); bulut oturumunda çalışmıyor
- [ ] Usta / kaptan / iş / güvenli ödeme arka ucu (2. dalga); sonra sitede usta-kaptan rehber sayfaları
- [ ] NVİ bağlantısı kodda hazır (`IDENTITY_MODE=nvi`); canlı sunucudan bir kez gerçek bilgilerle denenmeli (bulut oturumundan NVİ'ye erişilmedi)
- [ ] Anlık bildirimi gerçek telefonda dene: EAS projesi (`extra.eas.projectId`) + geliştirme derlemesi gerekir (Expo Go'da uzak bildirim çalışmıyor); sunucuda `PUSH_MODE=expo`
- [ ] Mağaza derlemesi (EAS build) ve mağaza başvurusu; şu an yalnızca Expo Go
- [ ] Veri kopyası telefonda dosya olarak paylaşılsın (çok büyük kopyada paylaşım menüsü sınırı)
- [ ] Yasaklama: hesap askıya alma var; silinip yeniden açılan hesabı tanıma yok (T.C. silmede serbest kaldığı için T.C.'ye dayanamaz, cihaz/telefon izine dayanmalı)
- [ ] Kapalı beta deneme hesaplarının temizliği (aynı T.C. ile açılmış kabul testi hesapları)

## Web/öne çıkarma — incelemeden ertelenen küçük maddeler
- [ ] Fiyatlar kuruşlu girilebilirse gösterim de kuruşlu olsun (şu an tam liraya yuvarlanıyor; yönetim ekranı tam lira giriyor)
- [ ] Canlı veritabanı yerelden kopyalanırsa demo içerik `scripts/remove-demo.ts` ile temizlenmeli (yeni kurulumda demo ilan zaten yüklenmez; yalnızca `SEED_DEMO=1` ile)
- [ ] Canlıda ters vekil (reverse proxy) Host başlığını korumalı ve TRUSTED_PROXY_HOPS doğru ayarlanmalı

## Canlıya çıkış altyapısı
- [ ] Sunucu ve alan adı, HTTPS
- [ ] Gerçek SMS sağlayıcısı
- [ ] Yük / yoğunluk testi

## Gelir fikirleri (sonra)
- [ ] Sigorta ve kredi yönlendirme komisyonu
- [ ] Marina ve nakliye ortaklıkları
- [ ] İlan verene fiyat raporu
