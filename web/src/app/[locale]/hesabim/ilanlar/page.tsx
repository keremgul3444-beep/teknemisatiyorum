import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { formatPrice, listingSlug } from '@/lib/format';
import type { ListingView } from '@/lib/types';
import { PromoBadges } from '@/components/PromoBadges';
import { RenewButton } from '@/components/AccountBits';

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
            const ends = live ? daysLeft(l.expiresAt ?? undefined) : null;
            const renewable = l.status === 'expired' || (ends !== null && ends <= 14);
            return (
              <div key={l.id} className="card spread">
                <div>
                  <strong>{live ? <Link href={localePath(locale, `/ilan/${listingSlug(l)}`)}>{l.brand} {l.model} · {l.year}</Link> : `${l.brand} ${l.model} · ${l.year}`}</strong>
                  <div className="muted small">{formatPrice(l.price, l.currency, locale)} · {t(locale, `account.status.${l.status}`, {})}</div>
                  {l.status === 'rejected' && l.rejectReason ? <div className="small" style={{ color: 'var(--c-danger)' }}>{t(locale, `account.rejectReasons.${l.rejectReason}`, {})}</div> : null}
                  {l.status === 'removed' && l.removedReason ? <div className="small" style={{ color: 'var(--c-danger)' }}>{t(locale, `account.removedReasons.${l.removedReason}`, {})}</div> : null}
                  {l.status === 'expired' ? <div className="small" style={{ color: 'var(--c-warning)' }}>{t(locale, 'account.expiredNote')}</div>
                    : renewable ? <div className="small" style={{ color: 'var(--c-warning)' }}>{t(locale, 'account.expiresIn', { n: ends ?? 0 })}</div> : null}
                  {l.stats ? <div className="muted small">{t(locale, 'account.stats', { v: l.stats.views, f: l.stats.favorites, m: l.stats.messages })}</div> : null}
                  <div className="row small" style={{ marginTop: 6 }}>
                    <PromoBadges promo={l.promo} priceDrop={l.priceDrop} locale={locale} />
                    {f ? <span>{t(locale, 'account.featuredLeft', { n: f })}</span> : null}
                    {u ? <span>{t(locale, 'account.urgentLeft', { n: u })}</span> : null}
                  </div>
                </div>
                {renewable ? <RenewButton listingId={l.id} label={t(locale, 'account.renew')} errors={tDict(locale, 'errors')} /> : null}
                {live
                  ? <Link className="btn" href={localePath(locale, `/hesabim/ilanlar/${l.id}/one-cikar`)}>{t(locale, 'account.promote')}</Link>
                  : <span className="muted small">{t(locale, l.status === 'sold' || l.status === 'removed' ? 'account.closedNote' : l.status === 'rejected' ? 'account.fixInApp' : l.status === 'expired' ? 'account.expiredShort' : 'account.notPublished')}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
