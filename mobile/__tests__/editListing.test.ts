import { draftChanges, fromListing, photosChanged, toDraft } from '@/features/listingForm';
import { api } from '@/services/api/instance';
import { actions, type Listing } from '@/services';
import { useStore } from '@/services/store';
import { useMode } from '@/services/mode';

const listing: Listing = {
  id: 'l1', brand: 'Bavaria', model: 'Cruiser 41', year: 2016, lengthM: 12.4, price: 149000, currency: 'EUR', type: 'yelkenli',
  location: 'Bodrum', equipment: ['jenerator'], badges: [], sellerId: 's', logbookCount: 0, description: 'Bakımlı', status: 'yayinda',
  photoSeed: 3, cabins: 3, engine: 'Volvo D2', engineHours: 850, flag: 'tr', tradeIn: false, negotiable: true,
  photoUrls: ['https://x/media/f1', 'https://x/media/f2'], photoIds: ['f1', 'f2'], rawStatus: 'published', isMine: true,
};

describe('düzenleme formu', () => {
  test('ilan forma eksiksiz çevrilir; değişmeyen form hiç fark üretmez', () => {
    const s = fromListing(listing, 'tr');
    expect(s.f).toMatchObject({ brand: 'Bavaria', year: '2016', length: '12,4', engineHours: '850', price: '149000' });
    expect(s.photos.map((p) => p.fileId)).toEqual(['f1', 'f2']);
    expect(draftChanges(toDraft(s), toDraft(s))).toEqual({});
    expect(toDraft(s)).toMatchObject({ lengthM: 12.4, engineHours: 850, flag: 'tr', negotiable: true });
  });

  test('yalnızca değişen alanlar bulunur (fiyat tek başına değişirse yalnızca fiyat)', () => {
    const s = fromListing(listing);
    expect(draftChanges(toDraft(s), toDraft({ ...s, f: { ...s.f, price: '139000' } }))).toEqual({ price: 139000 });
    expect(draftChanges(toDraft(s), toDraft({ ...s, equipment: ['jenerator', 'klima'], tradeIn: true }))).toEqual({ equipment: ['jenerator', 'klima'], tradeIn: true });
  });

  test('fotoğrafı olmayan (demo) ilan kapak görseliyle açılır ve değişmemiş sayılır', () => {
    const s = fromListing({ ...listing, photoUrls: undefined, photoIds: undefined });
    expect(s.photos).toHaveLength(1);
    expect(photosChanged(s.photos, s.photos)).toBe(false);
  });

  test('fotoğraf sırası, silme ve yeni fotoğraf değişiklik sayılır', () => {
    const p = fromListing(listing).photos;
    expect(photosChanged(p, p)).toBe(false);
    expect(photosChanged(p, [p[1], p[0]])).toBe(true);
    expect(photosChanged(p, [p[0]])).toBe(true);
    expect(photosChanged(p, [...p, { id: 'n', seed: 1, uri: 'file:///yeni.jpg' }])).toBe(true);
  });
});

describe('düzenlemeyi kaydetme (sunucu)', () => {
  beforeEach(() => {
    useMode.setState({ mode: 'api' });
    useStore.setState({ listings: [listing, { ...listing, id: 'r1', status: 'reddedildi', rawStatus: 'rejected' }] });
    jest.spyOn(api, 'get').mockImplementation(async (path: string) => (path.startsWith('/listings') ? { items: [], total: 0 } : []) as never);
  });
  afterEach(() => { jest.restoreAllMocks(); useMode.setState({ mode: 'demo' }); useStore.getState().resetDemo(); });

  test('yalnızca fiyat: tek PATCH, fotoğraf ve yeniden gönderim yok', async () => {
    const patch = jest.spyOn(api, 'patch').mockResolvedValue({} as never);
    const put = jest.spyOn(api, 'put').mockResolvedValue({} as never);
    const post = jest.spyOn(api, 'post').mockResolvedValue({} as never);
    await actions.updateListing('l1', { price: 139000 });
    expect(patch).toHaveBeenCalledWith('/listings/l1', { price: 139000 });
    expect(put).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  test('fotoğraf değişince yeniler yüklenir ve tam liste sırasıyla gider', async () => {
    const put = jest.spyOn(api, 'put').mockResolvedValue({} as never);
    jest.spyOn(api, 'upload').mockResolvedValue({ id: 'f9' } as never);
    const seen: string[] = [];
    await actions.updateListing('l1', {}, [{ uri: 'file:///yeni.jpg' }, { fileId: 'f2' }], { onProgress: (d, t) => seen.push(`${d}/${t}`) });
    expect(put).toHaveBeenCalledWith('/listings/l1/photos', { fileIds: ['f9', 'f2'] });
    expect(seen).toEqual(['0/1', '1/1']);
  });

  test('reddedilen ilan kaydedilince yeniden onaya gönderilir', async () => {
    jest.spyOn(api, 'patch').mockResolvedValue({} as never);
    const post = jest.spyOn(api, 'post').mockResolvedValue({} as never);
    await actions.updateListing('r1', { price: 100000 });
    expect(post).toHaveBeenCalledWith('/listings/r1/submit');
  });
});

describe('düzenleme ve kaldırma (demo)', () => {
  beforeEach(() => useStore.getState().resetDemo());

  test('yalnızca fiyat yayındaki ilanı yayında tutar; diğer değişiklik onaya düşürür', async () => {
    const l = useStore.getState().listings.find((x) => x.status === 'yayinda')!;
    await actions.updateListing(l.id, { price: 1000 });
    expect(useStore.getState().listings.find((x) => x.id === l.id)).toMatchObject({ status: 'yayinda', price: 1000 });
    await actions.updateListing(l.id, { description: 'Yeni yelken' });
    expect(useStore.getState().listings.find((x) => x.id === l.id)!.status).toBe('onay-bekliyor');
  });

  test('yayından kaldırılan ilan listeden çıkar', async () => {
    const l = useStore.getState().listings[0];
    await actions.withdrawListing(l.id);
    expect(useStore.getState().listings.some((x) => x.id === l.id)).toBe(false);
  });
});
