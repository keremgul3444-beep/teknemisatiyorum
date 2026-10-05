import type { Metadata } from 'next';
import { t, type Locale } from '@/i18n';
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
      {rows.length ? <ListingGrid items={rows} locale={locale} /> : <p className="muted">{t(locale, 'account.noFavorites')}</p>}
    </section>
  );
}
