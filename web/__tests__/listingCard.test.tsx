import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ListingCard } from '../src/components/ListingCard';
import type { ListingView } from '../src/lib/types';

// Test bitmeden bileşen sökülür: React'in zamanlanmış işi ortam kapandıktan sonra çalışıp "window is not defined" atmasın.
afterEach(() => cleanup());

const base: Omit<ListingView, 'promo'> = {
  id: 'ck1', brand: 'Bavaria', model: 'C46', year: 2014, lengthM: 14, type: 'yelkenli', price: 90000, currency: 'EUR',
  location: 'Göcek', photos: [], badges: [], equipment: [], description: '', status: 'published',
  seller: { id: 's', name: null, since: 2020, companyName: null },
};

test('vitrin ve acil etiketleri, doğru bağlantı', () => {
  render(<ListingCard locale="tr" listing={{ ...base, promo: { featured: true, urgent: true } } as ListingView} />);
  expect(screen.getByText('Vitrin')).toBeTruthy();
  expect(screen.getByText('Acil')).toBeTruthy();
  expect(screen.getByRole('link').getAttribute('href')).toBe('/ilan/bavaria-c46-2014-ck1');
});

test('İngilizcede /en önekli bağlantı; etiket yoksa rozet yok', () => {
  render(<ListingCard locale="en" listing={{ ...base, id: 'ck2', promo: { featured: false, urgent: false } } as ListingView} />);
  expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/en/ilan/bavaria-c46-2014-ck2')).toBe(true);
  expect(screen.queryByText('Featured')).toBeNull();
});
