import { jobStatusOf, toCaptainBooking, toJob, toProvider, type ApiJob, type ApiProvider } from '@/services/api/mappers';

const prov = (over: Partial<ApiProvider> = {}): ApiProvider => ({
  id: 'p1', kind: 'usta', name: 'Usta Ali', categories: ['motor'], region: 'Bodrum', bio: '', priceNote: '', yearsExp: 5, languages: [], areas: [],
  dayRateEur: null, weekRateEur: null, rating: null, reviewCount: 0, verified: true, ...over,
});
const job = (over: Partial<ApiJob> = {}): ApiJob => ({
  id: 'j1', category: 'motor', title: 'Motor', description: 'Sintineye su', region: '', boatId: 'b1', status: 'open', acceptedQuoteId: null,
  createdAt: '2026-10-03T10:00:00.000Z', quotes: [], ...over,
});
const quote = { id: 'q1', priceTry: 12000, days: 2, note: 'Yarın', provider: prov() };

test('sunucudaki iş durumu uygulamadaki adıma çevrilir', () => {
  expect(jobStatusOf(job())).toBe('talep');
  expect(jobStatusOf(job({ quotes: [quote] }))).toBe('teklif');
  expect(jobStatusOf(job({ status: 'accepted', quotes: [quote] }))).toBe('onay');
  expect(jobStatusOf(job({ status: 'paid', quotes: [quote] }))).toBe('devam');
  expect(jobStatusOf(job({ status: 'done', quotes: [quote] }))).toBe('tamam');
  expect(jobStatusOf(job({ status: 'done', quotes: [quote], reviewed: true }))).toBe('degerlendirildi');
  expect(jobStatusOf(job({ status: 'cancelled' }))).toBe('iptal');
});

test('iş, teklifler ve ödeme durumu eşlenir', () => {
  const j = toJob(job({ status: 'paid', quotes: [quote], acceptedQuoteId: 'q1', paymentStatus: 'held' }));
  expect(j).toMatchObject({ status: 'devam', paid: true, acceptedOfferId: 'q1', createdAt: '2026-10-03', boatId: 'b1' });
  expect(j.offers).toEqual([{ id: 'q1', providerId: 'p1', priceTRY: 12000, days: 2, note: 'Yarın' }]);
});

test('hizmet veren ve kaptan rezervasyonu eşlenir; haftalık ücret yoksa 6 günlük', () => {
  expect(toProvider(prov({ kind: 'kaptan', dayRateEur: 300, rating: 4.5 }))).toMatchObject({ dayRateEUR: 300, weekRateEUR: 1800, rating: 4.5 });
  expect(toProvider(prov()).rating).toBe(0);
  expect(toCaptainBooking({ id: 'c1', start: '2026-10-10', days: 7, totalEur: 1600, status: 'paid', captain: prov({ id: 'k1', kind: 'kaptan' }) }))
    .toMatchObject({ captainId: 'k1', totalEUR: 1600, paid: true, status: 'paid' });
});
