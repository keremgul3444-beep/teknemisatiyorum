import { render, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import '@/i18n';
import { ListingCard } from '@/components/ListingCard';
import { makeListings } from '@tms/shared';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const listing = makeListings()[0];

test('önizleme kartına dokunmak yönlendirmez', async () => {
  await render(<ListingCard listing={listing} disabled />);
  fireEvent.press(screen.getByText(`${listing.brand} ${listing.model} · ${listing.year}`));
  expect(router.push).not.toHaveBeenCalled();
});

test('normal kart ilan detayına gider', async () => {
  await render(<ListingCard listing={listing} />);
  fireEvent.press(screen.getByText(`${listing.brand} ${listing.model} · ${listing.year}`));
  expect(router.push).toHaveBeenCalledWith(`/ilan/${listing.id}`);
});
