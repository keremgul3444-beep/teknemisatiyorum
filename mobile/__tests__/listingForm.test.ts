import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_LISTING_PHOTOS, addPhotos, dropMissingFiles, emptyWizard, firstInvalidStep, groupThousands, makeCover, movePhoto, parseNum, removePhoto, restoreDraft,
  serializeDraft, toDraft, validateStep, type PhotoItem, type WizardState,
} from '@/features/listingForm';
import { clearAllListingDrafts, loadListingDraft, saveListingDraft } from '@/features/listingDraftStore';

let n = 0;
const id = () => `id${n++}`;
const photos = (k: number): PhotoItem[] => Array.from({ length: k }, (_, i) => ({ id: `p${i}`, seed: i, uri: `file:///p${i}.jpg` }));
const filled = (): WizardState => ({
  ...emptyWizard(),
  photos: photos(2),
  f: { brand: 'Bavaria', model: 'Cruiser 41', year: '2016', length: '12,4', cabins: '3', engine: 'Volvo D2', engineHours: '850', description: ' Bakımlı ', price: '149000' },
  type: 'yelkenli', location: 'Bodrum', flag: 'tr', tradeIn: true,
});

describe('fotoğraf listesi', () => {
  test('en fazla 20 fotoğraf eklenir, fazlası atılır', () => {
    const list = addPhotos(photos(18), [{ seed: 1 }, { seed: 2 }, { seed: 3 }], id);
    expect(list).toHaveLength(MAX_LISTING_PHOTOS);
    expect(addPhotos(list, [{ seed: 9 }], id)).toHaveLength(MAX_LISTING_PHOTOS);
  });

  test('sırala, kapak yap ve sil', () => {
    const list = photos(3);
    expect(movePhoto(list, 'p0', 1).map((p) => p.id)).toEqual(['p1', 'p0', 'p2']);
    expect(movePhoto(list, 'p0', -1)).toBe(list);
    expect(movePhoto(list, 'p2', 1)).toBe(list);
    expect(makeCover(list, 'p2').map((p) => p.id)).toEqual(['p2', 'p0', 'p1']);
    expect(removePhoto(list, 'p1').map((p) => p.id)).toEqual(['p0', 'p2']);
  });
});

describe('doğrulama', () => {
  test('boş adımlar alan alan hata verir', () => {
    expect(validateStep(0, emptyWizard())).toEqual({ photos: 'wizard.err.photos' });
    expect(validateStep(1, emptyWizard())).toEqual({ brand: 'wizard.err.required', model: 'wizard.err.required', year: 'wizard.err.required', length: 'wizard.err.required', type: 'wizard.err.type' });
    expect(validateStep(3, emptyWizard())).toEqual({ price: 'wizard.err.price', location: 'wizard.err.location' });
    expect(validateStep(2, emptyWizard())).toEqual({});
  });

  test('aralık dışı değerler yakalanır', () => {
    const s = filled();
    const now = new Date('2026-10-02');
    expect(validateStep(1, s, now)).toEqual({});
    expect(validateStep(1, { ...s, f: { ...s.f, year: '1850' } }, now).year).toBe('wizard.err.year');
    expect(validateStep(1, { ...s, f: { ...s.f, year: '2028' } }, now).year).toBe('wizard.err.year');
    expect(validateStep(1, { ...s, f: { ...s.f, length: '1,5' } }, now).length).toBe('wizard.err.length');
    expect(validateStep(1, { ...s, f: { ...s.f, engineHours: '250000' } }, now).engineHours).toBe('wizard.err.engineHours');
  });
});

test('taslak sunucu biçimine çevrilir', () => {
  expect(toDraft(filled())).toEqual({
    brand: 'Bavaria', model: 'Cruiser 41', year: 2016, lengthM: 12.4, price: 149000, currency: 'EUR', type: 'yelkenli', location: 'Bodrum',
    equipment: [], cabins: 3, engine: 'Volvo D2', description: 'Bakımlı', engineHours: 850, flag: 'tr', tradeIn: true, negotiable: false,
  });
  expect(toDraft({ ...filled(), f: { ...filled().f, engineHours: '' }, flag: undefined })).toMatchObject({ engineHours: null, flag: null });
});

test('fiyat binlik ayraçla gösterilir ve geri okunur', () => {
  expect(groupThousands('149000', 'tr')).toBe('149.000');
  expect(groupThousands('149000', 'en')).toBe('149,000');
  expect(groupThousands('', 'tr')).toBe('');
  expect(parseNum('149.000')).toBe(149000);
});

describe('taslak kaydı', () => {
  test('geri yüklenir; tarayıcıdaki geçici fotoğraf adresleri saklanmaz ve kullanıcı fotoğraf adımına döner', () => {
    const s = { ...filled(), step: 3, photos: [{ id: 'a', seed: 1, uri: 'blob:http://x/1' }, { id: 'b', seed: 2, uri: 'data:image/jpeg;base64,AA' }] };
    const back = restoreDraft(serializeDraft(s))!;
    expect(back.photos).toEqual([]);
    expect(back.step).toBe(0);
    expect(back.f.brand).toBe('Bavaria');

    const native = restoreDraft(serializeDraft({ ...filled(), step: 3 }))!;
    expect(native.photos.map((p) => p.uri)).toEqual(['file:///p0.jpg', 'file:///p1.jpg']);
    expect(native.step).toBe(3);
  });

  test('bozuk, eski biçimli ya da boş taslak yok sayılır', () => {
    expect(restoreDraft(null)).toBeNull();
    expect(restoreDraft('{bozuk')).toBeNull();
    expect(restoreDraft(JSON.stringify({ photos: [], f: {} }))).toBeNull();
    expect(restoreDraft(serializeDraft(emptyWizard()))).toBeNull();
  });

  test('hesaba özel saklanır; çıkışta hepsi silinir', async () => {
    await saveListingDraft('u1', filled());
    expect((await loadListingDraft('u1'))?.f.model).toBe('Cruiser 41');
    expect(await loadListingDraft('u2')).toBeNull();
    await saveListingDraft(undefined, filled());
    await AsyncStorage.setItem('baska.anahtar', 'x');
    await clearAllListingDrafts();
    expect(await loadListingDraft('u1')).toBeNull();
    expect(await loadListingDraft(undefined)).toBeNull();
    expect(await AsyncStorage.getItem('baska.anahtar')).toBe('x');
  });

  test('boşaltılan form kaydı siler', async () => {
    await saveListingDraft('u3', filled());
    await saveListingDraft('u3', emptyWizard());
    expect(await AsyncStorage.getItem('tms.listingDraft.u3')).toBeNull();
  });
});

describe('tüm adım denetimi ve kaybolan dosyalar', () => {
  test('önizlemeden önce ilk hatalı adım bulunur', () => {
    expect(firstInvalidStep(filled())).toBe(-1);
    expect(firstInvalidStep({ ...filled(), f: { ...filled().f, brand: '' } })).toBe(1);
    expect(firstInvalidStep({ ...filled(), location: undefined })).toBe(3);
    expect(firstInvalidStep({ ...filled(), photos: [] })).toBe(0);
  });

  test('cihazdan silinmiş fotoğraf ve belgeler düşer, sayısı bildirilir', () => {
    const s = { ...filled(), step: 3, doc: true, docUri: 'file:///ruhsat.jpg', engineDoc: true, engineDocUri: 'file:///motor.jpg' };
    const gone = new Set(['file:///p0.jpg', 'file:///ruhsat.jpg']);
    const { state, lostPhotos } = dropMissingFiles(s, (u) => !gone.has(u));
    expect(lostPhotos).toBe(1);
    expect(state.photos.map((p) => p.uri)).toEqual(['file:///p1.jpg']);
    expect(state).toMatchObject({ doc: false, docUri: null, engineDoc: true, step: 3 });
    expect(dropMissingFiles(s, () => false).state.step).toBe(0);
  });
});
