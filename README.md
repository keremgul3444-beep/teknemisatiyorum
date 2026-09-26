# teknemisatıyorum.com

Kapalı beta için tekne ilanı, broker, ekspertiz ve Tekne Karnesi uygulaması. Depo; ortak TypeScript kodu (`shared`), NestJS sunucusu (`api`) ve Expo uygulamasından (`mobile`) oluşur.

## Yerel çalıştırma

Node.js 22.13 veya üstü gerekir. İlk kurulumda depo kökünde `npm install` çalıştırın. Sonra:

```powershell
npm run dev
```

Bu komut gömülü PostgreSQL'i açar, migration'ları uygular, boş veritabanına başlangıç verisini yükler, API'yi derleyip başlatır ve Expo'yu açar. Sağlık kontrolü:

```powershell
curl.exe http://localhost:8081/api/health
```

Beklenen yanıt: `{"ok":true}`. Süreçleri ve veritabanını düzgün kapatmak için aynı terminalde `Ctrl+C` kullanın.

## Telefon ve tünel

Kişisel Expo erişim anahtarını yalnızca o terminalin `EXPO_TOKEN` ortam değişkenine verin; dosyaya ya da Git'e yazmayın. Ardından:

```powershell
npm run dev -- --tunnel
```

Terminalde görünen `exp://…exp.direct` adresini Expo Go ile açın. Uygulama API'ye aynı Expo tünelindeki `/api` yolu üzerinden ulaşır.

## Claude

Anthropic anahtarını yalnızca Git dışında tutulan `api/.env` dosyasındaki `ANTHROPIC_API_KEY` alanına yazın. Canlı bağlantıyı tek sorguyla sınamak için:

```powershell
cd api
node --env-file=.env --import tsx scripts/llm-smoke.ts "12 metreye kadar jeneratörlü 2015 sonrası"
```

Anahtar yoksa Akıllı Asistan kural tabanlı yedekle çalışmaya devam eder.

## Testler ve yedekler

```powershell
npm test -w shared
cd api; npx jest --runInBand
cd ..; npm test -w mobile
```

Sunucu açıldığında günlük mantıksal veritabanı yedeği `api/backups/` altında oluşturulur; son yedi günlük dosya tutulur. `api/.env`, `api/.data`, depolanan medya, yedekler ve hiçbir erişim anahtarı commit edilmez.
