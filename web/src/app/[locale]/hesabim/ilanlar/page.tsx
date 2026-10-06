import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { formatPrice, listingSlug } from '@/lib/format';
import type { ListingView } from '@/lib/types';
import { PromoBadges } from '@/components/PromoBadges';
import { ListingManage, RenewButton, UnsoldButton } from '@/components/AccountBits';

type P = { params: Promise<{ locale: string }> };
type DocRequest = { kind: string; status: 'pending' | 'approved' | 'rejected'; listingId: string | null; rejectReason: string | null; rejectNote: string | null };

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
  const [rows, docs] = await Promise.all([
    authedGet<ListingView[]>(locale, '/me/listings', '/hesabim/ilanlar'),
    authedGet<DocRequest[]>(locale, '/verification/requests/mine', '/hesabim/ilanlar').catch(() => [] as DocRequest[]),
  ]);
  // İlan başına en yeni ruhsat başvurusu (liste yeniden eskiye sıralı gelir).
  const docOf = (id: string) => docs.find((d) => d.kind === 'ruhsat' && d.listingId === id);
  const manageLabels = {
    sold: t(locale, 'account.markSold'), withdraw: t(locale, 'account.withdraw'), soldConfirm: t(locale, 'account.soldConfirm'),
    withdrawConfirm: t(locale, 'account.withdrawConfirm'), promoWarn: t(locale, 'account.promoWarn'), cancel: t(locale, 'account.cancel'),
  };
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
            const doc = docOf(l.id);
            return (
              <div key={l.id} className="card spread">
                <div>
                  <strong>{live ? <Link href={localePath(locale, `/ilan/${listingSlug(l)}`)}>{l.brand} {l.model} · {l.year}</Link> : `${l.brand} ${l.model} · ${l.year}`}</strong>
                  <div className="muted small">{formatPrice(l.price, l.currency, locale)} · {t(locale, `account.status.${l.status}`, {})}</div>
                  {l.status === 'rejected' && l.rejectReason ? <div className="small" style={{ color: 'var(--c-danger)' }}>{t(locale, `account.rejectReasons.${l.rejectReason}`, {})}</div> : null}
                  {l.status === 'rejected' && l.rejectNote ? <div className="small">{t(locale, 'account.rejectNote', { note: l.rejectNote })}</div> : null}
                  {l.pendingEdit ? <div className="small" style={{ color: 'var(--c-warning)' }}>{t(locale, 'account.pendingEdit')}</div> : null}
                  {live && !l.pendingEdit && l.rejectReason ? <div className="small" style={{ color: 'var(--c-danger)' }}>{t(locale, 'account.editRejected')} {t(locale, `account.rejectReasons.${l.rejectReason}`, {})}{l.rejectNote ? ` · ${l.rejectNote}` : ''}</div> : null}
                  {doc?.status === 'pending' ? <div className="muted small">{t(locale, 'account.docPending')}</div> : null}
                  {doc?.status === 'rejected' && !l.badges.includes('sahiplik') ? <div className="small" style={{ color: 'var(--c-danger)' }}>{t(locale, 'account.docRejected', { reason: t(locale, `account.rejectReasons.${doc.rejectReason ?? 'rules'}`, {}) })}{doc.rejectNote ? ` · ${doc.rejectNote}` : ''}</div> : null}
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
                <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                  {renewable ? <RenewButton listingId={l.id} label={t(locale, 'account.renew')} errors={tDict(locale, 'errors')} /> : null}
                  {live
                    ? <Link className="btn" href={localePath(locale, `/hesabim/ilanlar/${l.id}/one-cikar`)}>{t(locale, 'account.promote')}</Link>
                    : <span className="muted small">{t(locale, l.status === 'sold' || l.status === 'removed' ? 'account.closedNote' : l.status === 'rejected' ? 'account.fixInApp' : l.status === 'expired' ? 'account.expiredShort' : 'account.notPublished')}</span>}
                  {l.status === 'sold' || l.status === 'removed' ? null : (
                    <div className="row small">
                      <Link href={localePath(locale, `/hesabim/ilanlar/${l.id}/duzenle`)}>{t(locale, 'account.edit')}</Link>
                      {l.badges.includes('sahiplik') || doc?.status === 'pending' ? null : <Link href={localePath(locale, `/hesabim/ilanlar/${l.id}/belge`)}>{t(locale, 'account.document')}</Link>}
                    </div>
                  )}
                  {l.status === 'sold' ? <UnsoldButton listingId={l.id} label={t(locale, 'account.unsold')} errors={tDict(locale, 'errors')} /> : null}
                  {l.status === 'sold' || l.status === 'removed' ? null : (
                    <ListingManage listingId={l.id} canSell={live || l.status === 'expired'} promoActive={!!(f || u)} labels={manageLabels} errors={tDict(locale, 'errors')} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
