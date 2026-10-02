import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { formatPrice, listingSlug } from '@/lib/format';
import type { ListingView } from '@/lib/types';
import { PromoBadges } from '@/components/PromoBadges';

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.listings') }), robots: { index: false, follow: false } };
}

const daysLeft = (until?: string) => {
  const ms = until ? new Date(until).getTime() - Date.now() : 0;
  return ms > 0 ? Math.ceil(ms / 864e5) : null;
};

/** Kendi ilanlarım: durum, öne çıkarma süreleri ve yayındaki ilan için "Öne çıkar". */
export default async function HesabimIlanlar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await authedGet<ListingView[]>(locale, '/me/listings', '/hesabim/ilanlar');
  return (
    <section className="section">
      <h1>{t(locale, 'account.listings')}</h1>
      {rows.length === 0 ? <p className="muted">{t(locale, 'account.noListings')}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((l) => {
            const f = daysLeft(l.promo.featuredUntil);
            const u = daysLeft(l.promo.urgentUntil);
            const live = l.status === 'published';
            return (
              <div key={l.id} className="card spread">
                <div>
                  <strong>{live ? <Link href={localePath(locale, `/ilan/${listingSlug(l)}`)}>{l.brand} {l.model} · {l.year}</Link> : `${l.brand} ${l.model} · ${l.year}`}</strong>
                  <div className="muted small">{formatPrice(l.price, l.currency, locale)} · {t(locale, `account.status.${l.status}`, {})}</div>
                  <div className="row small" style={{ marginTop: 6 }}>
                    <PromoBadges promo={l.promo} priceDrop={l.priceDrop} locale={locale} />
                    {f ? <span>{t(locale, 'account.featuredLeft', { n: f })}</span> : null}
                    {u ? <span>{t(locale, 'account.urgentLeft', { n: u })}</span> : null}
                  </div>
                </div>
                {live
                  ? <Link className="btn" href={localePath(locale, `/hesabim/ilanlar/${l.id}/one-cikar`)}>{t(locale, 'account.promote')}</Link>
                  : <span className="muted small">{t(locale, 'account.notPublished')}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
