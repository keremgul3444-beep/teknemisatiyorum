# Kapalı beta kabul testi

Çalıştırma: 2026-09-26 17:56 · Betik: `mobile/scripts/beta-acceptance.mjs` · Gerçek sunucu (npm run dev) · Chrome 390×844

## ✓ 1. Telefonla giriş (kod SMS yerine uygulamaya gelir) — geçti

Satıcı numarasıyla kod istenir, kod ekranda dolar, Doğrula ile oturum açılır.

![kriter 1](beta-shots/kriter-1.jpg)

## ✓ 2. Kimlik → fotoğraflı ilan → yönetici onayı → Keşfet — geçti

Satıcı T.C. kimliğini doğrular, gerçek fotoğraf yükleyerek ilan verir; yönetici onaylar; ilan herkese açık aramada çıkar.

![kriter 2](beta-shots/kriter-2.jpg)

## ◐ 3. Akıllı Asistan (Claude ve yedeği) — kısmi

Asistana metin yazılır, sonuçlar veritabanından gelir. Claude anahtarı yoksa kural tabanlı yedek devrededir.

**Not:** Claude API anahtarı tanımlı değil; kural tabanlı yedek devrede ve doğru sonuç verdi. Claude ile yanıt, anahtar eklenince denenecek.

![kriter 3](beta-shots/kriter-3.jpg)

## ✓ 4. İki hesap mesajlaşır; yeniden açınca veriler yerinde — geçti

Alıcı ilandan satıcıya mesaj atar; satıcı yeniden yükleyip girince mesajı görür.

![kriter 4](beta-shots/kriter-4.jpg)

## ✓ 5. Karne, favori, kayıtlı arama, ekspertiz ve broker kalıcı — geçti

Alıcı tekne ekler, ilanı favoriler, arama kaydeder, ekspertiz randevusu ve broker başvurusu yapar; sayfa yenilenip tekrar girince hepsi yerinde.

![kriter 5](beta-shots/kriter-5.jpg)
