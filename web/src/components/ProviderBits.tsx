import Link from 'next/link';
import { localePath, t, type Locale } from '@/i18n';

export type ProviderView = {
  id: string; kind: 'usta' | 'kaptan'; name: string; categories: string[]; region: string; bio: string; priceNote: string; yearsExp: number;
  languages: string[]; areas: string[]; dayRateEur: number | null; weekRateEur: number | null; rating: number | null; reviewCount: number; verified: boolean;
  reviews?: { id: string; stars: number; text: string; createdAt: string }[];
};

/** Hizmet veren kartı (liste): ad, puan, bölge, alanlar ya da ücret. */
export function ProviderCard({ p, locale }: { p: ProviderView; locale: Locale }) {
  const href = localePath(locale, `/${p.kind}/${p.id}`);
  return (
    <Link href={href} className="card" style={{ display: 'grid', gap: 6, textDecoration: 'none', color: 'inherit' }}>
      <div className="spread">
        <strong>{p.name}</strong>
        <span className="small">{p.rating ? `★ ${p.rating} (${p.reviewCount})` : t(locale, 'providers.new')}</span>
      </div>
      <span className="muted small">{p.region}{p.yearsExp ? ` · ${t(locale, 'providers.years', { n: p.yearsExp })}` : ''} · {t(locale, 'providers.verified')}</span>
      {p.kind === 'usta'
        ? <span className="small">{p.categories.map((c) => t(locale, `ustaCat.${c}`)).join(', ')}</span>
        : <span className="small">{p.dayRateEur ? t(locale, 'providers.dayRate', { n: p.dayRateEur }) : ''}{p.weekRateEur ? ` · ${t(locale, 'providers.weekRate', { n: p.weekRateEur })}` : ''}</span>}
    </Link>
  );
}
