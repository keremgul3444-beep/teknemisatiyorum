import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import type { ProviderKind, UstaCategory } from './types';

export * from './types';
export * from './rates';
// Ekranlara açılan sabit demo verisi (gerçek API'de oturum/yönetim uç noktalarından gelecek).
export { DEMO_USER, BROKER_CONTACT, DEMO_DEVICES, ADMIN_USERS } from '@/mocks/people';

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

// Eylemler — demo modunda yerel depo, gerçek modda sunucu (bkz. actions.ts).
export { actions, type AssistantResult } from './actions';
export { useMode, isApiMode, API_URL } from './mode';
