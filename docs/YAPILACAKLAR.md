# Yapılacaklar — ertelenen işler ve kararlar

Sonraya bırakılan her iş burada durur. Bir iş bitince satırını silip commit mesajında an.
Kullanıcı hatırlatma istedi: her büyük aşama sonunda bu liste gözden geçirilir.

## Senin (Kerem/işletme) yapman gerekenler — ben yapamam
- [ ] Bulut depolama hesabı (Cloudflare R2 önerilir: çıkış trafiği ücretsiz) ve kova; anahtarları yalnızca sunucudaki `deploy/.env`'e yaz (`STORAGE_DRIVER=s3`, `S3_*`, `BACKUP_OFFSITE=1`). Kod hazır.
- [ ] Avukat onayı: KVKK aydınlatma metni, ön bilgilendirme formu, mesafeli satış sözleşmesi, kullanım koşulları, çerez politikası (taslakları sitede ve uygulamada "taslak" ibaresiyle duruyor; şirket unvanı/adres/MERSİS yer tutucuları doldurulmalı)
- [ ] KVKK m.9 standart sözleşmesi: yurt dışı sağlayıcılarla (Cloudflare, Expo, Anthropic) imzalanıp 5 iş günü içinde Kurula bildirilmeli; aydınlatma metni bunu varsayıyor. Sağlayıcı imzalamazsa o hizmet AB/TR alternatifiyle değiştirilmeli
- [ ] VERBİS kaydı; ticari ileti için İYS kaydı
- [ ] Lisanslı ödeme kuruluşuyla pazaryeri / alt üye işyeri anlaşması (iyzico, PayTR vb.) — şirket evrakı, vergi levhası. Emanet ödeme (usta/kaptan) 6493 kapsamında bu modeli gerektirir; o zamana kadar canlı `PAYMENTS_MODE=off`
- [ ] Ödeme açılmadan önce: komisyon ve öne çıkarma için e-fatura/e-arşiv entegratörü (sözleşme ve ön bilgilendirme metinleri ile ödeme öncesi onay kodda hazır)
- [ ] SMS sağlayıcı hesabı (Netgsm: başlık onayı + API alt kullanıcısı); kod hazır, `docs/CANLIYA-CIKIS.md` 2. adım
- [ ] Sunucu + alan adı + DNS (alan adı, www, api A kayıtları); kurulum `docs/CANLIYA-CIKIS.md`
- [ ] Kesinti takibi (UptimeRobot → `/health/ready`) ve hata takibi hesabı (GlitchTip önerilir; DSN'i `ERROR_DSN`'e yaz)
- [ ] Apple Developer hesabı (~99$/yıl) ve Google Play Console hesabı (~25$ tek sefer)
- [ ] Claude API anahtarı (Akıllı Asistan şu an kural tabanlı yedekle çalışıyor)
- [ ] Google Search Console kaydı (site canlıya çıkınca)
- [ ] Sohbete yapıştırılan Expo token'larını expo.dev → Access Tokens'tan sil
- [ ] Broker komisyon oranı ve öne çıkarma fiyatları kararı (piyasa araştırmasıyla)
- [ ] Şirket unvanı/adresi ve gerçek iletişim e-postası (sitede şimdilik iletisim@teknemisatiyorum.com yazıyor, alan adı alınınca açılmalı)

## Web sitesi
- [ ] Aşama 2 ödeme: gerçek sanal POS ve gerçek Apple/Google ödemesi (hesaplar açılınca, deneme modunun yerine takılır)
- [ ] Blog / içerik yazıları (SEO için değerli, ayrı içerik işi)
- [ ] Ziyaretçi ölçümü: Umami kodda hazır (çerez onayıyla, `/stats`); sunucuda `--profile analytics` ile aç ve site kimliğini gir (`docs/CANLIYA-CIKIS.md` 7. bölüm)
- [ ] Teklif talepleri (finansman, sigorta, nakliye): iş ortaklarıyla anlaşma; talepler `/yonetim/talepler`'de toplanır, paylaşım KVKK metnine eklendi, avukat onayı gerekir
- [ ] Gerçek ödeme açılınca: emanete alınmadan iade sayılan ödemelerin parası sağlayıcıda da iade edilmeli (`docs/denetim-2026-10-06.md`, Canlıda dikkat)
- [ ] Canlı sunucuda hız ölçümünü (Lighthouse) tekrarla; yerel ölçüm: ana sayfa 96, ilan 92
- [ ] Uygulamanın "Öne çıkar" ekranını uçtan uca tarayıcı testiyle dene (bu turda bellek yetersizliğinden uygulama önizlemesi açılmadı; aynı sunucu ucu kabul testinde denendi)

## Uygulama ve arka uç
- [ ] API uçtan uca testleri: bulut oturumunda sistem PostgreSQL 16 ile 40 dosya / 216+ test geçti; yerelde gömülü veritabanıyla bir kez `cd api; npx jest --runInBand` çalıştırılmalı
- [ ] 2. dalga canlı öncesi: emanet ödemenin hizmet verene gerçek aktarımı (sanal POS alt üye işyeri / pazaryeri modeli) sağlayıcı anlaşmasıyla bağlanmalı; şu an durum platformda izleniyor
- [ ] NVİ bağlantısı kodda hazır (`IDENTITY_MODE=nvi`); canlı sunucudan bir kez gerçek bilgilerle denenmeli (bulut oturumundan NVİ'ye erişilmedi)
- [ ] Anlık bildirimi gerçek telefonda dene: EAS projesi (`extra.eas.projectId`) + geliştirme derlemesi gerekir (Expo Go'da uzak bildirim çalışmıyor); sunucuda `PUSH_MODE=expo`
- [ ] Mağaza derlemesi ve başvurusu: kod hazır (`eas.json`, paket kimliği, zorunlu güncelleme, ilan bağlantıları); `eas init` + Apple/Google hesapları ve mağaza metinleri/görselleri senden (`docs/CANLIYA-CIKIS.md` 6. adım)
- [ ] Kapalı beta deneme hesaplarının temizliği: canlıda bir kez `scripts/cleanup-accounts.ts <numaralar>` (önce önizleme, sonra `--apply`)

## Web/öne çıkarma — incelemeden ertelenen küçük maddeler
- [ ] Canlı veritabanı yerelden kopyalanırsa demo içerik `scripts/remove-demo.ts` ile temizlenmeli (yeni kurulumda demo ilan zaten yüklenmez; yalnızca `SEED_DEMO=1` ile)
- [ ] Canlıda ters vekil (reverse proxy) Host başlığını korumalı ve TRUSTED_PROXY_HOPS doğru ayarlanmalı

## Canlıya çıkış altyapısı
- [ ] Docker imajları bulut oturumunda derlenemedi (Debian deposuna ağ izni yok); adımlar yerelde ayrı ayrı doğrulandı (site derlemesi, API canlı ayarla açılış). İlk sunucu kurulumunda `up -d --build` çıktısı kontrol edilmeli
- [ ] Netgsm: kod resmî kütüphanedeki REST v2 ucuna göre yazıldı; gerçek hesapla ilk giriş SMS'i son kanıt
- [ ] Siteden ilan düzenleme ve ruhsat yükleme birim ve ara katman testleriyle doğrulandı; ilk canlı denemede tarayıcıda bir kez uçtan uca denenmeli

## Gelir fikirleri (sonra)
- [ ] Sigorta ve kredi yönlendirme komisyonu
- [ ] Marina ve nakliye ortaklıkları
- [ ] İlan verene fiyat raporu
