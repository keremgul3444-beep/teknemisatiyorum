import { useStore } from '@/services/store';

const s = () => useStore.getState();
beforeEach(() => s().resetDemo());

test('seed sayıları', () => {
  expect(s().listings).toHaveLength(25);
  expect(s().providers.filter((p) => p.kind === 'usta')).toHaveLength(12);
  expect(s().providers.filter((p) => p.kind === 'kaptan')).toHaveLength(8);
  expect(s().expertisePackages).toHaveLength(3);
  expect(s().companies).toHaveLength(2);
});

test('her usta kategorisinde en az bir usta var', () => {
  const cats = ['motor', 'elektrik', 'boya', 'jelkot', 'branda', 'doseme', 'elektronik', 'yelken'];
  cats.forEach((c) => expect(s().providers.some((p) => p.kind === 'usta' && p.categories.includes(c as any))).toBe(true));
});

test('olmayan id undefined döner', () => {
  expect(s().listings.find((l) => l.id === 'xyz')).toBeUndefined();
});

test('yeni ilan onay bekler ve yönetim kuyruğuna düşer', () => {
  const id = s().createListing({
    brand: 'Beneteau', model: 'Oceanis 40', year: 2016, lengthM: 12.2, price: 180000,
    currency: 'EUR', type: 'yelkenli', location: 'Bodrum', equipment: ['branda'], cabins: 3, engine: 'Yanmar 45hp', description: 'x',
  });
  expect(s().listings.find((l) => l.id === id)?.status).toBe('onay-bekliyor');
  expect(s().adminItems.some((a) => a.kind === 'ilan' && a.title.includes('Oceanis 40'))).toBe(true);
});

test('yönetim onayı ilanı yayına alır', () => {
  const id = s().createListing({
    brand: 'X', model: 'Y1', year: 2016, lengthM: 10, price: 1, currency: 'EUR', type: 'yelkenli',
    location: 'Bodrum', equipment: [], cabins: 1, engine: 'e', description: 'd',
  });
  const item = s().adminItems.find((a) => a.refId === id)!;
  s().setAdminStatus(item.id, 'onaylandi');
  expect(s().listings.find((l) => l.id === id)?.status).toBe('yayinda');
});

test('iş akışı sırayla ilerler ve karneye yazar', () => {
  const boat = s().boats[0];
  const before = boat.logbook.length;
  const jobId = s().createJob({ category: 'motor', title: 'Motor su alıyor', description: 'd', boatId: boat.id });
  const job = () => s().jobs.find((j) => j.id === jobId)!;
  expect(job().status).toBe('teklif');
  expect(job().offers).toHaveLength(3);
  s().payJob(jobId);
  expect(job().paid).toBe(false);
  s().acceptOffer(jobId, job().offers[1].id);
  expect(job().status).toBe('onay');
  s().acceptOffer(jobId, job().offers[0].id);
  expect(job().acceptedOfferId).toBe(job().offers[1].id);
  s().payJob(jobId);
  expect(job().status).toBe('devam');
  s().completeJob(jobId);
  expect(job().status).toBe('tamam');
  s().payJob(jobId);
  expect(job().status).toBe('tamam');
  s().rateJob(jobId, 5);
  expect(job().status).toBe('degerlendirildi');
  expect(s().boats.find((b) => b.id === boat.id)!.logbook.length).toBe(before + 1);
});

test('kaptan ücreti: 7 gün ve üstü haftalık', () => {
  const cap = s().providers.find((p) => p.kind === 'kaptan')!;
  const id3 = s().bookCaptain({ captainId: cap.id, start: '2026-10-01', days: 3 });
  const id7 = s().bookCaptain({ captainId: cap.id, start: '2026-10-01', days: 7 });
  expect(s().captainBookings.find((b) => b.id === id3)!.totalEUR).toBe(cap.dayRateEUR! * 3);
  expect(s().captainBookings.find((b) => b.id === id7)!.totalEUR).toBe(cap.weekRateEUR!);
});

test('mesaj ve numara paylaşımı', () => {
  const c = s().conversations[0];
  s().sendMessage(c.id, 'Merhaba');
  expect(s().conversations[0].messages.at(-1)).toMatchObject({ from: 'me', text: 'Merhaba' });
  s().sharePhone(c.id);
  expect(s().conversations[0].phoneShared).toBe(true);
});

test('favori aç/kapa ve arama kaydet', () => {
  const id = s().listings[0].id;
  s().toggleFavorite(id);
  expect(s().favorites).toContain(id);
  s().toggleFavorite(id);
  expect(s().favorites).not.toContain(id);
  s().saveSearch('12 m jeneratör');
  expect(s().savedSearches[0].query).toBe('12 m jeneratör');
});

test('reset seed durumuna döner', () => {
  s().toggleFavorite('l1');
  s().resetDemo();
  expect(s().favorites).toEqual([]);
  expect(s().listings).toHaveLength(25);
});
