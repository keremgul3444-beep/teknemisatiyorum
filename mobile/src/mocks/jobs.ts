import type { AdminItem, AuditEntry, BrokerCase, Job, Offer, Provider, UstaCategory } from '@/services/types';

export const CATEGORY_BASE_TRY: Record<UstaCategory, number> = {
  motor: 18000, elektrik: 9000, boya: 32000, jelkot: 21000, branda: 14000, doseme: 16000, elektronik: 11000, yelken: 19000,
};
const FACTORS = [1, 1.18, 0.92];
const DAYS = [3, 2, 5];
const NOTES = ['Parça dahil, 6 ay işçilik garantisi.', 'Hızlı teslim, orijinal parça.', 'Uygun fiyat, marinada yerinde servis.'];

export function makeOffers(category: UstaCategory, providers: Provider[], idPrefix: string): Offer[] {
  const inCat = providers.filter((p) => p.kind === 'usta' && p.categories.includes(category));
  const pool = [...inCat, ...providers.filter((p) => p.kind === 'usta' && !inCat.includes(p))].slice(0, 3);
  return pool.map((p, i) => ({
    id: `${idPrefix}-o${i + 1}`, providerId: p.id, priceTRY: Math.round(CATEGORY_BASE_TRY[category] * FACTORS[i]), days: DAYS[i], note: NOTES[i],
  }));
}

export const makeJobs = (providers: Provider[]): Job[] => {
  const j1Offers = makeOffers('boya', providers, 'j1');
  return [
    {
      id: 'j1', category: 'boya', title: 'Güverte boyası', description: 'Güverte zımpara ve boya yenileme.', boatId: 'b1',
      status: 'devam', offers: j1Offers, acceptedOfferId: j1Offers[0].id, paid: true, createdAt: '2026-09-15',
    },
    {
      id: 'j2', category: 'elektrik', title: 'Akü şarj etmiyor', description: 'Servis aküsü motor çalışırken şarj olmuyor.', boatId: 'b2',
      status: 'teklif', offers: makeOffers('elektrik', providers, 'j2'), paid: false, createdAt: '2026-09-22',
    },
  ];
};

export const makeBrokerCases = (): BrokerCase[] => [{ id: 'bc1', boatName: 'Deniz Kızı', step: 2, askingEUR: 98000, createdAt: '2026-08-30' }];

export const makeAdminItems = (): AdminItem[] => [
  { id: 'a1', kind: 'ilan', title: 'Beneteau First 27', who: 'Oğuz B.', status: 'bekliyor' },
  { id: 'a2', kind: 'ilan', title: 'Riva Aquarama', who: 'Ege Tekne Galerisi', status: 'bekliyor' },
  { id: 'a3', kind: 'ilan', title: 'Bavaria 46', who: 'Canan T.', status: 'bekliyor' },
  { id: 'a4', kind: 'belge', title: 'Ustalık belgesi — Kaan Polat', who: 'Kaan Polat', status: 'bekliyor', refId: 'p10' },
  { id: 'a5', kind: 'belge', title: 'Vergi levhası — Ozan Kurt', who: 'Ozan Kurt', status: 'bekliyor', refId: 'p11' },
  { id: 'a6', kind: 'belge', title: 'Kaptan Yeterlik — Barış Ateş', who: 'Kaptan Barış Ateş', status: 'bekliyor', refId: 'k7' },
];

export const makeAudit = (): AuditEntry[] => [
  { id: 'au1', at: '2026-09-25 09:14', who: 'moderator@ekip', action: 'İlan onaylandı: Hanse 418' },
  { id: 'au2', at: '2026-09-25 08:52', who: 'destek@ekip', action: 'Kullanıcı kaydı görüntülendi (maskeli): Elif S.' },
  { id: 'au3', at: '2026-09-24 18:03', who: 'finans@ekip', action: 'Ödeme ustaya aktarıldı: j0 · ₺14.000' },
  { id: 'au4', at: '2026-09-24 16:40', who: 'moderator@ekip', action: 'Belge reddedildi: SRC Telsiz (okunaksız)' },
];
