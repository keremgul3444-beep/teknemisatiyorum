import { create } from 'zustand';
import { t } from 'i18next';
import type {
  AdminItem, AdminStatus, AuditEntry, Boat, BoatInput, BrokerCase, CaptainBooking, Company, Conversation, ExpertiseBooking,
  ExpertisePackage, Job, JobInput, Listing, ListingDraft, Provider, SavedSearch, Seller, SubjectKind,
} from './types';
import { makeListings } from '@tms/shared';
import { makeProviders } from '@/mocks/providers';
import { DEMO_USER, makeBoats, makeCompanies, makeConversations, makeExpertisePackages, makeSavedSearches, makeSellers } from '@/mocks/people';
import { makeAdminItems, makeAudit, makeBrokerCases, makeJobs, makeOffers } from '@/mocks/jobs';

export interface Data {
  listings: Listing[]; providers: Provider[]; jobs: Job[]; boats: Boat[]; conversations: Conversation[];
  savedSearches: SavedSearch[]; favorites: string[]; expertisePackages: ExpertisePackage[]; expertiseBookings: ExpertiseBooking[];
  captainBookings: CaptainBooking[]; brokerCases: BrokerCase[]; companies: Company[]; sellers: Seller[];
  adminItems: AdminItem[]; audit: AuditEntry[];
}

export interface Actions {
  createListing(d: ListingDraft): string;
  toggleFavorite(id: string): void;
  saveSearch(query: string): string;
  createJob(input: JobInput): string;
  acceptOffer(jobId: string, offerId: string): void;
  payJob(jobId: string): void;
  completeJob(jobId: string): void;
  rateJob(jobId: string, stars: number): void;
  bookCaptain(input: { captainId: string; start: string; days: number }): string;
  payCaptain(bookingId: string): void;
  bookExpertise(input: { packageId: string; listingId?: string; date: string; slot: string }): string;
  applyBroker(input: { boatName: string; askingEUR: number }): string;
  advanceBroker(id: string): void;
  addBoat(input: BoatInput): string;
  sendMessage(convId: string, text: string, from?: 'me' | 'them'): void;
  sharePhone(convId: string): void;
  markRead(convId: string): void;
  startConversation(subject: { kind: SubjectKind; id: string; title: string }, withName: string): string;
  setAdminStatus(id: string, status: AdminStatus): void;
  resetDemo(): void;
}

let counter = 100;
const nextId = (p: string) => `${p}${++counter}`;
const today = () => new Date().toISOString().slice(0, 10);
const nowHM = () => new Date().toTimeString().slice(0, 5);

export function seed(): Data {
  const providers = makeProviders();
  return {
    listings: makeListings(), providers, jobs: makeJobs(providers), boats: makeBoats(), conversations: makeConversations(),
    savedSearches: makeSavedSearches(), favorites: [], expertisePackages: makeExpertisePackages(), expertiseBookings: [],
    captainBookings: [], brokerCases: makeBrokerCases(), companies: makeCompanies(), sellers: makeSellers(),
    adminItems: makeAdminItems(), audit: makeAudit(),
  };
}

export const useStore = create<Data & Actions>((set, get) => {
  const updateJob = (id: string, fn: (j: Job) => Job | null) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const next = fn(job);
    if (next) set({ jobs: get().jobs.map((j) => (j.id === id ? next : j)) });
  };
  const log = (key: string, params: Record<string, string>, who = 'demo@kullanici') =>
    set({ audit: [{ id: nextId('au'), at: `${today()} ${nowHM()}`, who, key, params }, ...get().audit] });

  return {
    ...seed(),

    createListing(d) {
      const id = nextId('l');
      const listing: Listing = {
        ...d, id, badges: [], sellerId: 'me', logbookCount: 0, status: 'onay-bekliyor', photoSeed: counter,
      };
      set({
        listings: [listing, ...get().listings],
        adminItems: [{ id: nextId('a'), kind: 'ilan', title: `${d.brand} ${d.model}`, who: DEMO_USER.name, status: 'bekliyor', refId: id }, ...get().adminItems],
      });
      return id;
    },

    toggleFavorite(id) {
      const f = get().favorites;
      set({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [id, ...f] });
    },

    saveSearch(query) {
      const id = nextId('s');
      set({ savedSearches: [{ id, query, createdAt: today(), newMatches: 0 }, ...get().savedSearches] });
      return id;
    },

    createJob(input) {
      const id = nextId('j');
      const job: Job = { ...input, id, status: 'teklif', offers: makeOffers(input.category, get().providers, id), paid: false, createdAt: today() };
      set({ jobs: [job, ...get().jobs] });
      return id;
    },

    acceptOffer(jobId, offerId) {
      updateJob(jobId, (j) => (j.status === 'teklif' && j.offers.some((o) => o.id === offerId) ? { ...j, status: 'onay', acceptedOfferId: offerId } : null));
    },
    payJob(jobId) {
      updateJob(jobId, (j) => (j.status === 'onay' ? { ...j, paid: true, status: 'devam' } : null));
    },
    completeJob(jobId) {
      updateJob(jobId, (j) => (j.status === 'devam' ? { ...j, status: 'tamam' } : null));
    },
    rateJob(jobId, stars) {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || job.status !== 'tamam') return;
      const offer = job.offers.find((o) => o.id === job.acceptedOfferId);
      const usta = get().providers.find((p) => p.id === offer?.providerId);
      updateJob(jobId, (j) => ({ ...j, status: 'degerlendirildi', rating: stars }));
      set({
        boats: get().boats.map((b) =>
          b.id === job.boatId
            ? { ...b, logbook: [...b.logbook, { id: nextId('lg'), date: today(), kind: 'onarim', title: job.title, by: usta?.name ?? '—', verified: true }] }
            : b),
      });
    },

    bookCaptain({ captainId, start, days }) {
      const cap = get().providers.find((p) => p.id === captainId);
      const day = cap?.dayRateEUR ?? 0;
      const week = cap?.weekRateEUR ?? day * 6;
      const totalEUR = days >= 7 ? week * Math.ceil(days / 7) : day * days;
      const id = nextId('cb');
      set({ captainBookings: [{ id, captainId, start, days, totalEUR, paid: false }, ...get().captainBookings] });
      return id;
    },
    payCaptain(bookingId) {
      set({ captainBookings: get().captainBookings.map((b) => (b.id === bookingId ? { ...b, paid: true } : b)) });
    },

    bookExpertise(input) {
      const id = nextId('xb');
      set({ expertiseBookings: [{ id, ...input }, ...get().expertiseBookings] });
      return id;
    },

    applyBroker({ boatName, askingEUR }) {
      const id = nextId('bc');
      set({ brokerCases: [{ id, boatName, askingEUR, step: 0, createdAt: today() }, ...get().brokerCases] });
      return id;
    },
    advanceBroker(id) {
      const c = get().brokerCases.find((x) => x.id === id);
      if (!c || c.step >= 4) return;
      set({ brokerCases: get().brokerCases.map((x) => (x.id === id ? { ...x, step: (x.step + 1) as BrokerCase['step'] } : x)) });
      log('audit.brokerAdvanced', { boat: c.boatName }, 'broker@ekip');
    },

    addBoat(input) {
      const id = nextId('b');
      set({
        boats: [...get().boats, {
          ...input, id, photoSeed: counter,
          logbook: [{ id: nextId('lg'), date: today(), kind: 'sahiplik', title: t('logbook.boatAdded'), by: t('logbook.owner'), verified: false }],
        }],
      });
      return id;
    },

    sendMessage(convId, text, from = 'me') {
      set({
        conversations: get().conversations.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, { id: nextId('m'), from, text, at: nowHM() }] } : c),
      });
    },
    sharePhone(convId) {
      set({ conversations: get().conversations.map((c) => (c.id === convId ? { ...c, phoneShared: true } : c)) });
    },
    markRead(convId) {
      set({ conversations: get().conversations.map((c) => (c.id === convId ? { ...c, unread: false } : c)) });
    },
    startConversation(subject, withName) {
      const existing = get().conversations.find((c) => c.subject.kind === subject.kind && c.subject.id === subject.id);
      if (existing) return existing.id;
      const id = nextId('cv');
      set({ conversations: [{ id, withName, subject, phoneShared: false, unread: false, messages: [] }, ...get().conversations] });
      return id;
    },

    setAdminStatus(id, status) {
      const item = get().adminItems.find((a) => a.id === id);
      if (!item) return;
      set({ adminItems: get().adminItems.map((a) => (a.id === id ? { ...a, status } : a)) });
      if (item.kind === 'ilan' && item.refId && status === 'onaylandi') {
        set({ listings: get().listings.map((l) => (l.id === item.refId ? { ...l, status: 'yayinda' } : l)) });
      }
      if (item.kind === 'belge' && item.refId && status === 'onaylandi') {
        set({ providers: get().providers.map((p) => (p.id === item.refId ? { ...p, verified: true } : p)) });
      }
      const verb = status === 'onaylandi' ? 'Approved' : 'Rejected';
      log(`audit.${item.kind === 'ilan' ? 'listing' : 'doc'}${verb}`, { title: item.title }, 'moderator@ekip');
    },

    resetDemo() {
      set(seed());
    },
  };
});
