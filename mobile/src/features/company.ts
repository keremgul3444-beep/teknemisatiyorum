import type { Currency } from '@/services/types';

/** Sunucudaki firma paneli yanıtı (GET /companies/:id). */
export interface CompanyDetail {
  id: string; name: string; kind: 'galeri' | 'broker' | 'tersane' | 'servis'; city: string; myRole: 'owner' | 'admin' | 'staff';
  members: { userId: string; role: 'owner' | 'admin' | 'staff'; name: string | null; phone: string | null; me: boolean }[];
  listings: {
    id: string; title: string; year: number; price: number; currency: Currency; status: string; ownerName: string | null;
    cover: string | null; expiresAt: string | null; stats?: { views: number; favorites: number; messages: number };
  }[];
}

export const isManager = (d: Pick<CompanyDetail, 'myRole'>) => d.myRole === 'owner' || d.myRole === 'admin';
/** Personeli yalnızca sahip ve yönetici çıkarabilir; sahip ve kişinin kendisi çıkarılamaz. */
export const canRemove = (d: Pick<CompanyDetail, 'myRole'>, m: CompanyDetail['members'][number]) => isManager(d) && m.role !== 'owner' && !m.me;
/** "5xx xxx xx xx" → "+905xxxxxxxxx"; eksikse null. */
export function toPhone(input: string): string | null {
  const d = input.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '');
  return d.length === 10 && d.startsWith('5') ? `+90${d}` : null;
}
