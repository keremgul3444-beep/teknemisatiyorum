import { useStore } from '@/services/store';
import { toListing, type ApiListing } from '@/services/api/mappers';

test('sunucudaki "expired" durumu "Süresi doldu" olur ve bitiş tarihi taşınır', () => {
  const l = toListing({
    id: 'abc12345', brand: 'B', model: 'M', year: 2018, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum', equipment: [],
    cabins: 1, engine: '', description: '', status: 'expired', badges: [], photos: [], seller: { id: 's', name: 'x', since: 2020 },
    logbook: null, isMine: true, expiresAt: '2026-10-01T00:00:00.000Z',
  } as unknown as ApiListing);
  expect(l.status).toBe('suresi-doldu');
  expect(l.expiresAt).toBe('2026-10-01T00:00:00.000Z');
});

test('demo: yenilenen ilan yayına döner ve 90 günlük bitiş alır', () => {
  const s = useStore.getState();
  const id = s.listings[0].id;
  useStore.setState({ listings: s.listings.map((x) => (x.id === id ? { ...x, status: 'suresi-doldu' } : x)) });
  useStore.getState().renewListing(id);
  const l = useStore.getState().listings.find((x) => x.id === id)!;
  expect(l.status).toBe('yayinda');
  expect(new Date(l.expiresAt!).getTime()).toBeGreaterThan(Date.now() + 89 * 864e5);
});
