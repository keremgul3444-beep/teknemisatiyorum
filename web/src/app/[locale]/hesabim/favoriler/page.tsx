import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { CompareSelect } from '@/components/AccountLists';
import { authedGet } from '@/lib/auth-server';
import type { ListingView } from '@/lib/types';
import { ListingGrid } from '@/components/bits';

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.favorites') }), robots: { index: false, follow: false } };
}

/** Favoriler (uygulamadakiyle aynı liste): yayındaki ve satılmış ilanlar. */
export default async function Favoriler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await authedGet<ListingView[]>(locale, '/favorites', '/hesabim/favoriler');
  return (
    <section className="section">
      <h1>{t(locale, 'account.favorites')}</h1>
      <CompareSelect items={rows.filter((l) => l.status === 'published').map((l) => ({ id: l.id, title: `${l.brand} ${l.model} · ${l.year}` }))} href={localePath(locale, '/karsilastir')}
        L={{ cta: t(locale, 'compare.cta', { n: '{{n}}' }), select: t(locale, 'compare.select', { max: 3 }), hint: t(locale, 'compare.hint') }} />
      {rows.length ? <ListingGrid items={rows} locale={locale} /> : <p className="muted">{t(locale, 'account.noFavorites')}</p>}
    </section>
  );
}
