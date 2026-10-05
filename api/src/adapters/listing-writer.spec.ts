import { locative, rulesDescription } from './listing-writer';

test('bulunma eki', () => {
  expect(['Bodrum', 'Göcek', 'Marmaris', 'Fethiye', 'Kaş', 'Çeşme', 'Antalya', 'İstanbul', 'Datça'].map(locative))
    .toEqual(["Bodrum'da", "Göcek'te", "Marmaris'te", "Fethiye'de", "Kaş'ta", "Çeşme'de", "Antalya'da", "İstanbul'da", "Datça'da"]);
});

test('kural tabanlı açıklama yalnızca verilen alanları yazar', () => {
  expect(rulesDescription({ brand: 'Azimut', model: '50', year: 2015, lengthM: 15, type: 'motoryat', location: 'Göcek', equipment: [] }))
    .toBe("2015 model Azimut 50, 15 metre motoryat. Tekne Göcek'te.");
});
