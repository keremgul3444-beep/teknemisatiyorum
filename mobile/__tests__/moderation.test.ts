import { toAdminListing, toListing, toSeller, type ApiListing } from '@/services/api/mappers';
import { api } from '@/services/api/instance';
import { actions } from '@/services';
import { useStore } from '@/services/store';
import { useMode } from '@/services/mode';
import { tx } from '@/i18n';
import { useSession } from '@/session/role';

const apiListing = (over: Partial<ApiListing> = {}): ApiListing => ({
  id: 'l1', brand: 'Hanse', model: '418', year: 2021, lengthM: 12.4, type: 'yelkenli', price: 265000, currency: 'EUR', location: 'Çeşme',
  equipment: [], cabins: 3, engine: '', description: '', status: 'published', badges: [], photos: [],
  seller: { id: 's1', name: 'A', since: 2024, companyName: null }, logbook: null, isMine: false, ...over,
});

test('reddedilen ilan "onay bekliyor" değil "reddedildi" olur ve gerekçesi taşınır', () => {
  const l = toListing(apiListing({ status: 'rejected', rejectReason: 'mismatch', isMine: true }));
  expect(l.status).toBe('reddedildi');
  expect(l.rejectReason).toBe('mismatch');
});

test('"Doğrulanmış" bilgisi sunucudan gelir; gelmezse doğrulanmamış sayılır', () => {
  expect(toSeller(apiListing({ seller: { id: 's', name: 'A', since: 2024, companyName: null, verified: true } })).verified).toBe(true);
  expect(toSeller(apiListing()).verified).toBe(false);
});

test('onay kuyruğu ilanın tamamını ve sürümünü moderatöre taşır', () => {
  const item = toAdminListing({
    id: 'l1', title: 'Hanse 418', ownerName: 'A', photos: [], version: '2026-10-02T10:00:00.000Z', ownerVerifyLevel: 1,
    year: 2021, price: 265000, currency: 'EUR', lengthM: 12.4, type: 'yelkenli', location: 'Çeşme', cabins: 3, engine: 'Volvo',
    engineHours: 850, flag: 'tr', tradeIn: true, negotiable: false, equipment: ['branda'], description: 'IBAN TR00',
  });
  expect(item.version).toBe('2026-10-02T10:00:00.000Z');
  expect(item.listing).toMatchObject({ description: 'IBAN TR00', engineHours: 850, flag: 'tr', tradeIn: true, ownerVerifyLevel: 1 });
});

test('karne metninde yalnızca "logbook." sistem anahtarları çevrilir (platform yazısı taklit edilemez)', () => {
  const t = (k: string) => `T(${k})`;
  expect(tx(t, 'i18n:logbook.owner')).toBe('T(logbook.owner)');
  expect(tx(t, 'i18n:badge.broker')).toBe('i18n:badge.broker');
  expect(tx(t, 'Motor bakımı')).toBe('Motor bakımı');
});

describe('moderatör kararı', () => {
  beforeEach(() => {
    useMode.setState({ mode: 'api' });
    useSession.setState({ staff: true });
    // Kuyruk ve ilan listesi yenilemesi: boş yanıtlar.
    jest.spyOn(api, 'get').mockImplementation(async (path: string) => (path.startsWith('/listings') ? { items: [], total: 0 } : []) as never);
    useStore.setState({ adminItems: [toAdminListing({ id: 'l1', title: 'Hanse 418', ownerName: 'A', version: 'v1', year: 2021 })] });
  });
  afterEach(() => { jest.restoreAllMocks(); useMode.setState({ mode: 'demo' }); useSession.setState({ staff: false }); });

  test('seçilen red gerekçesi ve görülen sürüm sunucuya gider', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({} as never);
    await actions.setAdminStatus('l:l1', 'reddedildi', 'blurry');
    expect(post).toHaveBeenCalledWith('/admin/listings/l1/decision', { decision: 'reject', reason: 'blurry', version: 'v1' });
  });

  test('ilan değiştiyse karar hata verir ve kuyruk yenilenir', async () => {
    jest.spyOn(api, 'post').mockRejectedValue(Object.assign(new Error('LISTING_CHANGED'), { status: 409 }));
    await expect(actions.setAdminStatus('l:l1', 'onaylandi')).rejects.toThrow('LISTING_CHANGED');
    expect(api.get).toHaveBeenCalledWith('/admin/queue?kind=listing');
  });
});

test('demo: red, ilanı "reddedildi" yapar ve gerekçeyi yazar', () => {
  const s = useStore.getState();
  const id = s.createListing({ brand: 'B', model: 'M', year: 2018, lengthM: 10, price: 1, currency: 'EUR', type: 'yelkenli', location: 'Bodrum', equipment: [], cabins: 0, engine: '', description: '' });
  const item = useStore.getState().adminItems.find((a) => a.refId === id)!;
  useStore.getState().setAdminStatus(item.id, 'reddedildi', 'mismatch');
  expect(useStore.getState().listings.find((l) => l.id === id)).toMatchObject({ status: 'reddedildi', rejectReason: 'mismatch' });
});
