import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import type { ProviderKind, UstaCategory } from './types';

export * from './types';
export * from './rates';

// Okuma hook'ları — ekranların veriye tek erişim yolu.
export const useListings = () => useStore((s) => s.listings);
export const useListing = (id?: string) => useStore((s) => s.listings.find((l) => l.id === id));
export const useProviders = (kind: ProviderKind, category?: UstaCategory) =>
  useStore(useShallow((s) => s.providers.filter((p) => p.kind === kind && (!category || p.categories.includes(category)))));
export const useAllProviders = () => useStore((s) => s.providers);
export const useProvider = (id?: string) => useStore((s) => s.providers.find((p) => p.id === id));
export const useJobs = () => useStore((s) => s.jobs);
export const useJob = (id?: string) => useStore((s) => s.jobs.find((j) => j.id === id));
export const useBoats = () => useStore((s) => s.boats);
export const useBoat = (id?: string) => useStore((s) => s.boats.find((b) => b.id === id));
export const useConversations = () => useStore((s) => s.conversations);
export const useConversation = (id?: string) => useStore((s) => s.conversations.find((c) => c.id === id));
export const useSavedSearches = () => useStore((s) => s.savedSearches);
export const useFavorites = () => useStore((s) => s.favorites);
export const useExpertisePackages = () => useStore((s) => s.expertisePackages);
export const useExpertiseBookings = () => useStore((s) => s.expertiseBookings);
export const useCaptainBookings = () => useStore((s) => s.captainBookings);
export const useBrokerCases = () => useStore((s) => s.brokerCases);
export const useBrokerCase = (id?: string) => useStore((s) => s.brokerCases.find((c) => c.id === id));
export const useCompanies = () => useStore((s) => s.companies);
export const useSeller = (id?: string) => useStore((s) => s.sellers.find((x) => x.id === id));
export const useAdminItems = () => useStore((s) => s.adminItems);
export const useAudit = () => useStore((s) => s.audit);

// Eylemler — gerçek API gelince yalnızca bu katmanın arkası değişir.
const g = () => useStore.getState();
export const actions = {
  createListing: (...a: Parameters<ReturnType<typeof g>['createListing']>) => g().createListing(...a),
  toggleFavorite: (id: string) => g().toggleFavorite(id),
  saveSearch: (q: string) => g().saveSearch(q),
  createJob: (...a: Parameters<ReturnType<typeof g>['createJob']>) => g().createJob(...a),
  acceptOffer: (jobId: string, offerId: string) => g().acceptOffer(jobId, offerId),
  payJob: (jobId: string) => g().payJob(jobId),
  completeJob: (jobId: string) => g().completeJob(jobId),
  rateJob: (jobId: string, stars: number) => g().rateJob(jobId, stars),
  bookCaptain: (...a: Parameters<ReturnType<typeof g>['bookCaptain']>) => g().bookCaptain(...a),
  payCaptain: (id: string) => g().payCaptain(id),
  bookExpertise: (...a: Parameters<ReturnType<typeof g>['bookExpertise']>) => g().bookExpertise(...a),
  applyBroker: (...a: Parameters<ReturnType<typeof g>['applyBroker']>) => g().applyBroker(...a),
  advanceBroker: (id: string) => g().advanceBroker(id),
  addBoat: (...a: Parameters<ReturnType<typeof g>['addBoat']>) => g().addBoat(...a),
  sendMessage: (convId: string, text: string, from?: 'me' | 'them') => g().sendMessage(convId, text, from),
  sharePhone: (convId: string) => g().sharePhone(convId),
  markRead: (convId: string) => g().markRead(convId),
  startConversation: (...a: Parameters<ReturnType<typeof g>['startConversation']>) => g().startConversation(...a),
  setAdminStatus: (...a: Parameters<ReturnType<typeof g>['setAdminStatus']>) => g().setAdminStatus(...a),
  resetDemo: () => g().resetDemo(),
};
