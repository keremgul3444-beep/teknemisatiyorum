import type { Provider, UstaCategory } from '@/services/types';

const ustaDocs = (verified: boolean) => [
  { name: 'Vergi levhası', expires: '2027-12-31', verified },
  { name: 'Ustalık belgesi', expires: '2029-06-30', verified },
];

type U = [string, UstaCategory[], number, number, string, boolean, string, number];
const USTALAR: U[] = [
  ['Mehmet Arslan', ['motor'], 4.9, 140, 'Bodrum', true, 'Volvo Penta ve Yanmar motor revizyonu', 22],
  ['Serkan Yıldız', ['motor', 'elektrik'], 4.6, 58, 'Göcek', true, 'Dıştan takma ve iç motor bakımı', 12],
  ['Ali Demirtaş', ['elektrik', 'elektronik'], 4.7, 71, 'Marmaris', true, 'Akü, şarj sistemi, navigasyon kurulumu', 15],
  ['Hakan Çelik', ['boya'], 4.8, 96, 'İstanbul', true, 'Zehirli boya, gövde boyası, vernik', 18],
  ['Emre Kaya', ['jelkot', 'boya'], 4.5, 33, 'Çeşme', true, 'Jelkot tamiri, osmoz tedavisi', 9],
  ['Murat Aksoy', ['branda'], 4.9, 112, 'Bodrum', true, 'Bimini, sprayhood, kışlık branda dikimi', 25],
  ['Burak Öztürk', ['doseme'], 4.4, 21, 'Fethiye', true, 'Kabin ve kokpit döşemesi, minder', 7],
  ['Cem Şahin', ['elektronik'], 4.6, 40, 'İstanbul', true, 'Radar, plotter, otopilot kurulumu', 11],
  ['Tolga Erdem', ['yelken'], 4.8, 64, 'Marmaris', true, 'Yelken tamiri, arma ayarı', 20],
  ['Kaan Polat', ['jelkot'], 4.2, 12, 'Didim', false, 'Küçük jelkot ve cam elyaf işleri', 5],
  ['Ozan Kurt', ['motor'], 4.3, 9, 'Antalya', false, 'Dıştan takma motor servisi', 4],
  ['Deniz Uçar', ['boya', 'doseme'], 4.7, 45, 'Göcek', true, 'Güverte bakımı ve tik yenileme', 14],
];

type K = [string, number, string, string[], string[], number, boolean];
const KAPTANLAR: K[] = [
  ['Kaptan Levent Aydın', 350, 'Bodrum', ['TR', 'EN'], ['Bodrum', 'Gökova', 'Datça'], 24, true],
  ['Kaptan Selin Er', 280, 'Göcek', ['TR', 'EN', 'DE'], ['Göcek', 'Fethiye', 'Kaş'], 11, true],
  ['Kaptan Orhan Tekin', 300, 'Marmaris', ['TR', 'EN'], ['Marmaris', 'Bozburun', 'Rodos'], 18, true],
  ['Kaptan Yusuf Kara', 220, 'İstanbul', ['TR'], ['Boğaz', 'Adalar', 'Marmara'], 9, true],
  ['Kaptan Ece Güneş', 260, 'Çeşme', ['TR', 'EN', 'FR'], ['Çeşme', 'Alaçatı', 'Sakız'], 8, true],
  ['Kaptan Kemal Uysal', 320, 'Fethiye', ['TR', 'EN', 'RU'], ['Fethiye', 'Kaş', 'Kekova'], 20, true],
  ['Kaptan Barış Ateş', 180, 'Antalya', ['TR', 'EN'], ['Antalya', 'Kemer'], 5, false],
  ['Kaptan Nilay Soylu', 240, 'İstanbul', ['TR', 'EN'], ['Boğaz', 'Adalar'], 7, true],
];

type E = [string, string, number, number];
const EKSPERLER: E[] = [
  ['Eksper Ahmet Yalçın', 'Bodrum', 4.9, 88],
  ['Eksper Zeynep Doğan', 'İstanbul', 4.8, 61],
  ['Eksper Can Bilgin', 'Göcek', 4.7, 37],
];

export const makeProviders = (): Provider[] => [
  ...USTALAR.map(([name, categories, rating, reviewCount, region, verified, bio, yearsExp], i): Provider => ({
    id: `p${i + 1}`, kind: 'usta', name, categories: [...categories], rating, reviewCount, region, verified,
    docs: ustaDocs(verified), priceNote: 'Keşif ücretsiz', bio, yearsExp,
  })),
  ...KAPTANLAR.map(([name, day, region, languages, areas, yearsExp, verified], i): Provider => ({
    id: `k${i + 1}`, kind: 'kaptan', name, categories: [], rating: 4.5 + (i % 5) / 10, reviewCount: 10 + i * 9, region, verified,
    docs: [
      { name: 'Kaptan Yeterlik', expires: i === 1 ? '2026-10-15' : '2028-05-01', verified },
      { name: 'SRC Telsiz', expires: '2027-09-01', verified },
      { name: 'İlk Yardım', expires: '2027-03-01', verified },
    ],
    priceNote: `€${day}/gün`, bio: `${yearsExp} yıllık deneyim. ${areas.join(', ')} sularını iyi bilir.`,
    dayRateEUR: day, weekRateEUR: day * 6, languages: [...languages], yearsExp, areas: [...areas],
  })),
  ...EKSPERLER.map(([name, region, rating, reviewCount], i): Provider => ({
    id: `e${i + 1}`, kind: 'eksper', name, categories: [], rating, reviewCount, region, verified: true,
    docs: [{ name: 'Gemi Sörveyörlüğü Belgesi', expires: '2028-01-01', verified: true }],
    priceNote: 'Paket fiyatı', bio: 'Bağımsız tekne eksperi.', yearsExp: 10 + i * 4,
  })),
];
