import type { Boat, Company, Conversation, ExpertisePackage, Role, SavedSearch, Seller } from '@/services/types';

export const DEMO_USER = { name: 'Deniz Yılmaz' };
export const BROKER_CONTACT = { name: 'Aslı Er', company: 'Mavi Koy Yatçılık' };

export const DEMO_DEVICES: { id: string; name: string; city: string; ago: { unit: 'now' | 'days' | 'weeks'; n: number }; current: boolean }[] = [
  { id: 'd1', name: 'iPhone 15 · iOS', city: 'İstanbul', ago: { unit: 'now', n: 0 }, current: true },
  { id: 'd2', name: 'Chrome · Windows', city: 'Bodrum', ago: { unit: 'days', n: 2 }, current: false },
  { id: 'd3', name: 'Samsung S23 · Android', city: 'Göcek', ago: { unit: 'weeks', n: 3 }, current: false },
];

export const ADMIN_USERS: { name: string; role: Role; level: number; phone: string; joined: string }[] = [
  { name: 'Deniz Yılmaz', role: 'bireysel', level: 2, phone: '+905321234512', joined: '2026-03-02' },
  { name: 'Mehmet Arslan', role: 'usta', level: 3, phone: '+905339876540', joined: '2025-11-19' },
  { name: 'Kaptan Selin Er', role: 'kaptan', level: 3, phone: '+905445551203', joined: '2026-01-07' },
  { name: 'Mavi Koy Yatçılık', role: 'kurumsal', level: 3, phone: '+902523130088', joined: '2025-08-30' },
  { name: 'Elif S.', role: 'bireysel', level: 1, phone: '+905057778899', joined: '2026-09-21' },
];

export const makeSellers = (): Seller[] => [
  { id: 'u1', name: 'Ahmet K.', since: 2021 },
  { id: 'u2', name: 'Elif S.', since: 2023 },
  { id: 'u3', name: 'Mert A.', since: 2022 },
  { id: 'u4', name: 'Canan T.', since: 2024 },
  { id: 'u5', name: 'Oğuz B.', since: 2020 },
  { id: 'u6', name: 'Derya M.', since: 2025 },
  { id: 'c1', name: 'Mavi Koy Yatçılık', since: 2019, companyId: 'c1' },
  { id: 'c2', name: 'Ege Tekne Galerisi', since: 2020, companyId: 'c2' },
];

export const makeCompanies = (): Company[] => [
  { id: 'c1', name: 'Mavi Koy Yatçılık', kind: 'broker', city: 'Bodrum', staff: ['Selim Ak (Yönetici)', 'Aslı Er (Broker)', 'Tuna Kılıç (Broker)'], listingIds: ['l7', 'l15', 'l23'] },
  { id: 'c2', name: 'Ege Tekne Galerisi', kind: 'galeri', city: 'Çeşme', staff: ['Rıza Ay (Yönetici)', 'Gizem Öz (Satış)'], listingIds: ['l8', 'l16', 'l24'] },
];

export const makeBoats = (): Boat[] => [
  {
    id: 'b1', name: 'Deniz Kızı', brand: 'Jeanneau', model: 'Sun Odyssey 349', year: 2019, lengthM: 10.3, photoSeed: 3,
    logbook: [
      { id: 'lg1', date: '2021-05-12', kind: 'sahiplik', title: 'Sahiplik devri (noter)', by: 'Liman Başkanlığı', verified: true },
      { id: 'lg2', date: '2023-04-02', kind: 'bakim', title: 'Motor yıllık bakımı', by: 'Mehmet Arslan', verified: true },
      { id: 'lg3', date: '2024-03-18', kind: 'ekspertiz', title: 'Kapsamlı ekspertiz — 84/100', by: 'Eksper Ahmet Yalçın', verified: true },
      { id: 'lg4', date: '2025-02-20', kind: 'onarim', title: 'Zehirli boya yenileme', by: 'Hakan Çelik', verified: true },
    ],
  },
  {
    id: 'b2', name: 'Poyraz', brand: 'Marin', model: 'Sürat 7', year: 2021, lengthM: 7.1, photoSeed: 9,
    logbook: [{ id: 'lg5', date: '2022-06-01', kind: 'sahiplik', title: 'Tekne eklendi', by: 'Sahibi', verified: false }],
  },
];

export const makeConversations = (): Conversation[] => [
  {
    id: 'cv1', withName: 'Ahmet K.', subject: { kind: 'ilan', id: 'l1', title: 'Azimut 40 · 2017' }, phoneShared: false, unread: true,
    messages: [
      { id: 'm1', from: 'me', text: 'Merhaba, tekne hâlâ satılık mı?', at: '10:12' },
      { id: 'm2', from: 'them', text: 'Merhaba, evet satılık. Göcek\'te görebilirsiniz.', at: '10:20' },
      { id: 'm3', from: 'me', text: 'Ekspertiz yaptırmamda sakınca var mı?', at: '10:22' },
      { id: 'm4', from: 'them', text: 'Hiç sorun değil, rapor da paylaşırım.', at: '10:31' },
    ],
  },
  {
    id: 'cv2', withName: 'Mavi Koy Yatçılık', subject: { kind: 'ilan', id: 'l15', title: 'Fountaine Pajot Lucia 40 · 2017' }, phoneShared: false, unread: false,
    messages: [
      { id: 'm5', from: 'me', text: 'Kışlama nerede yapılıyor?', at: 'Dün' },
      { id: 'm6', from: 'them', text: 'Marmaris\'te çekekte, karnede kayıtlı.', at: 'Dün' },
      { id: 'm7', from: 'them', text: 'Hafta sonu görüşme ayarlayabiliriz.', at: 'Dün' },
    ],
  },
  {
    id: 'cv3', withName: 'Hakan Çelik', subject: { kind: 'is', id: 'j1', title: 'Güverte boyası' }, phoneShared: true, unread: false,
    messages: [
      { id: 'm8', from: 'them', text: 'Zımparaya bugün başladık.', at: 'Pzt' },
      { id: 'm9', from: 'me', text: 'Harika, fotoğraf atabilir misiniz?', at: 'Pzt' },
      { id: 'm10', from: 'them', text: 'Akşam paylaşırım.', at: 'Pzt' },
    ],
  },
  {
    id: 'cv4', withName: 'Kaptan Selin Er', subject: { kind: 'kaptan', id: 'k2', title: 'Haftalık kaptan' }, phoneShared: false, unread: true,
    messages: [
      { id: 'm11', from: 'me', text: 'Ekim ilk hafta müsait misiniz?', at: 'Paz' },
      { id: 'm12', from: 'them', text: 'Evet, Göcek çıkışlı olabilir.', at: 'Paz' },
      { id: 'm13', from: 'them', text: 'Rotayı birlikte planlayalım.', at: 'Paz' },
    ],
  },
];

export const makeSavedSearches = (): SavedSearch[] => [
  { id: 's1', query: '12 metreye kadar jeneratörlü brandalı 2015 sonrası', createdAt: '2026-09-10', newMatches: 2 },
];

export const makeExpertisePackages = (): ExpertisePackage[] => [
  { id: 'x1', name: 'Temel', priceTRY: 12500, items: ['Gövde görsel kontrol', 'Motor çalıştırma testi', 'Belge kontrolü'] },
  { id: 'x2', name: 'Kapsamlı', priceTRY: 24000, items: ['Temel paketin tamamı', 'Deniz testi', 'Elektrik sistemi', 'Motor yağ analizi'] },
  { id: 'x3', name: 'Premium', priceTRY: 42000, items: ['Kapsamlı paketin tamamı', 'Çekekte sualtı gövde kontrolü', 'Termal kamera', 'Detaylı fotoğraflı rapor'] },
];
