import type { BadgeKind, BoatType, Currency, Equipment, ListingStatus } from '../filter';

export interface SeedListing {
  id: string; brand: string; model: string; year: number; lengthM: number; price: number; currency: Currency;
  type: BoatType; location: string; equipment: Equipment[]; badges: BadgeKind[]; sellerId: string;
  logbookCount: number; description: string; status: ListingStatus; photoSeed: number; cabins: number; engine: string;
}

type Row = [string, string, number, number, number, Currency, BoatType, string, Equipment[], BadgeKind[], number, string];

export const LISTING_ROWS: Row[] = [
  ['Azimut', '40', 2017, 12.2, 285000, 'EUR', 'motoryat', 'Göcek', ['jenerator', 'branda', 'klima'], ['ekspertizli', 'sahiplik'], 3, '2x Volvo IPS 435'],
  ['Beneteau', 'Oceanis 45', 2015, 13.7, 165000, 'EUR', 'yelkenli', 'Bodrum', ['branda', 'otopilot'], ['sahiplik'], 3, 'Yanmar 57hp'],
  ['Sunseeker', 'Manhattan 52', 2014, 16.2, 520000, 'EUR', 'motoryat', 'İstanbul', ['jenerator', 'klima', 'bowThruster', 'teak'], ['ekspertizli'], 3, '2x Volvo D11'],
  ['Jeanneau', 'Sun Odyssey 349', 2019, 10.3, 98000, 'EUR', 'yelkenli', 'Marmaris', ['branda'], ['sahiplik'], 2, 'Yanmar 21hp'],
  ['Özel Yapım', 'Gulet 24', 2012, 24.0, 1450000, 'EUR', 'gulet', 'Bodrum', ['jenerator', 'klima', 'tender', 'teak'], ['broker'], 6, 'Mercedes 500hp'],
  ['Lagoon', '42', 2018, 12.8, 395000, 'EUR', 'katamaran', 'Göcek', ['jenerator', 'klima', 'branda'], ['ekspertizli', 'sahiplik'], 4, '2x Yanmar 57hp'],
  ['Galeon', '360 Fly', 2020, 11.3, 310000, 'EUR', 'motoryat', 'Çeşme', ['jenerator', 'branda', 'bowThruster'], ['sahiplik'], 2, '2x Volvo D4'],
  ['Bavaria', 'Cruiser 37', 2016, 11.3, 105000, 'EUR', 'yelkenli', 'Fethiye', ['otopilot'], [], 3, 'Volvo 30hp'],
  ['Prestige', '460', 2016, 14.3, 410000, 'EUR', 'motoryat', 'İstanbul', ['jenerator', 'klima', 'bowThruster', 'branda'], ['ekspertizli'], 3, '2x Volvo IPS 600'],
  ['Marin', 'Sürat 7', 2021, 7.1, 1850000, 'TRY', 'surat', 'İstanbul', ['branda'], ['sahiplik'], 0, 'Yamaha 200hp'],
  ['Ege Tekne', 'Balıkçı 9', 2008, 9.0, 1250000, 'TRY', 'balikci', 'Didim', [], [], 1, 'Isuzu 90hp'],
  ['Dufour', '390 GL', 2019, 11.9, 178000, 'EUR', 'yelkenli', 'Bodrum', ['branda', 'otopilot'], ['ekspertizli', 'sahiplik'], 3, 'Volvo 40hp'],
  ['Ferretti', '550', 2013, 17.2, 690000, 'EUR', 'motoryat', 'Bodrum', ['jenerator', 'klima', 'bowThruster', 'teak', 'tender'], ['broker'], 3, '2x MAN 800hp'],
  ['Quicksilver', '675 Cruiser', 2022, 6.6, 1650000, 'TRY', 'surat', 'Antalya', ['branda'], [], 0, 'Mercury 150hp'],
  ['Fountaine Pajot', 'Lucia 40', 2017, 11.7, 360000, 'EUR', 'katamaran', 'Marmaris', ['jenerator', 'branda'], ['sahiplik'], 4, '2x Volvo 30hp'],
  ['Özel Yapım', 'Gulet 32', 2010, 32.0, 2400000, 'EUR', 'gulet', 'Göcek', ['jenerator', 'klima', 'tender', 'teak', 'radar'], ['broker', 'ekspertizli'], 8, '2x Cummins 450hp'],
  ['Hanse', '418', 2021, 12.4, 265000, 'EUR', 'yelkenli', 'Çeşme', ['branda', 'otopilot', 'radar'], ['sahiplik'], 3, 'Volvo 45hp'],
  ['Princess', 'V50', 2011, 15.5, 340000, 'EUR', 'motoryat', 'Fethiye', ['jenerator', 'klima'], [], 2, '2x Volvo D12'],
  ['Karaburun', 'Balıkçı 7', 2015, 7.0, 690000, 'TRY', 'balikci', 'Çeşme', [], ['sahiplik'], 0, 'Yanmar 30hp'],
  ['Absolute', '47 Fly', 2019, 14.7, 720000, 'EUR', 'motoryat', 'İstanbul', ['jenerator', 'klima', 'bowThruster', 'branda'], ['ekspertizli', 'sahiplik'], 3, '2x Volvo IPS 600'],
  ['Elan', 'Impression 45', 2014, 13.9, 139000, 'EUR', 'yelkenli', 'Kaş', ['branda'], [], 4, 'Volvo 55hp'],
  ['Sea Ray', 'Sundancer 320', 2017, 10.4, 6900000, 'TRY', 'motoryat', 'Antalya', ['jenerator', 'branda'], ['sahiplik'], 1, '2x MerCruiser 300hp'],
  ['Özel Yapım', 'Gulet 20', 2005, 20.0, 590000, 'EUR', 'gulet', 'Marmaris', ['jenerator', 'tender'], [], 4, 'Iveco 350hp'],
  ['Cranchi', 'E26 Rider', 2020, 8.0, 95000, 'EUR', 'surat', 'Bodrum', ['branda'], ['ekspertizli'], 1, '2x Mercury 200hp'],
  ['Leopard', '45', 2020, 13.7, 590000, 'USD', 'katamaran', 'Göcek', ['jenerator', 'klima', 'branda', 'otopilot'], ['ekspertizli', 'sahiplik', 'broker'], 4, '2x Yanmar 57hp'],
];

const SELLERS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'c1', 'c2'];

export const makeListings = (): SeedListing[] =>
  LISTING_ROWS.map(([brand, model, year, lengthM, price, currency, type, location, equipment, badges, cabins, engine], i) => ({
    id: `l${i + 1}`, brand, model, year, lengthM, price, currency, type, location,
    equipment: [...equipment], badges: [...badges], cabins, engine,
    sellerId: SELLERS[i % SELLERS.length], logbookCount: (i * 7) % 19, status: 'yayinda', photoSeed: i,
    description: `${year} model ${brand} ${model}, ${location}'da bağlı. Düzenli bakımları yapılmış, kışlamaları çekekte geçirilmiş; ilk sahibinden ya da tek elden devralınmış, ekspertize açıktır.`,
  }));
