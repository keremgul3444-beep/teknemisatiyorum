import Link from 'next/link';
import type { Metadata } from 'next';
import { paymentRisk, type Currency } from '@tms/shared';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { formatPrice } from '@/lib/format';
import { AdminNav } from '@/components/AdminNav';
import { ListingDecision } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Item = {
  id: string; title: string; year: number; price: number; currency: Currency; ownerName: string | null; ownerVerifyLevel: number; photos: string[]; version: string;
  lengthM: number; type: string; location: string; cabins: number; engine: string; engineHours: number | null; flag: string | null; tradeIn: boolean; negotiable: boolean;
  equipment: string[]; description: string; previousRejectReason: string | null; changed?: string[] | null; photoDuplicates: { listingId: string; title: string; status: string; sameOwner: boolean }[];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navListings') }), robots: { index: false, follow: false } };
}

/** İlan onay kuyruğu: yayına çıkacak her şey (fotoğraflar, açıklama, özellikler), kopya fotoğraf uyarısı, önceki red gerekçesi. */
export default async function IlanOnaylari({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Item[]>(locale, '/admin/queue?kind=listing', '/yonetim/ilanlar');
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navListings')}</h1>
      <AdminNav locale={locale} current="/yonetim/ilanlar" />
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.empty')}</p> : (
        <div style={{ display: 'grid', gap: 16 }}>
          {rows.map((l) => (
            <article key={l.id} className="card" style={{ display: 'grid', gap: 10 }}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{l.title} · {l.year}</h2>
                <strong>{formatPrice(l.price, l.currency, locale)}</strong>
              </div>
              <p className="muted small" style={{ margin: 0 }}>{t(locale, 'admin.by', { who: l.ownerName ?? '—' })} · {t(locale, 'admin.sellerLevel', { n: l.ownerVerifyLevel })}</p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                {l.photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={src} href={src} target="_blank" rel="noreferrer"><img src={`${src}?w=400`} alt="" style={{ height: 96, borderRadius: 8 }} /></a>
                ))}
              </div>
              <p className="small" style={{ margin: 0 }}>
                {l.lengthM} m · {t(locale, `boatType.${l.type}`)} · {l.location} · {l.cabins} · {l.engine || '—'}{l.engineHours != null ? ` · ${l.engineHours} h` : ''}
                {l.flag ? ` · ${t(locale, l.flag === 'tr' ? 'sell.flagTr' : 'sell.flagForeign')}` : ''}{l.tradeIn ? ` · ${t(locale, 'sell.tradeIn')}` : ''}{l.negotiable ? ` · ${t(locale, 'sell.negotiable')}` : ''}
              </p>
              {l.equipment.length ? <p className="small muted" style={{ margin: 0 }}>{l.equipment.map((e) => t(locale, `equipment.${e}`)).join(', ')}</p> : null}
              {l.description ? <p className="small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{l.description}</p> : null}
              {paymentRisk(l.description) ? <p className="small" role="note" style={{ margin: 0, color: 'var(--c-danger)' }}>{t(locale, 'admin.paymentRisk')}</p> : null}
              {l.photoDuplicates.map((d) => (
                <p key={d.listingId} className="small" role="note" style={{ margin: 0, color: d.sameOwner ? 'var(--c-warning)' : 'var(--c-danger)' }}>
                  {t(locale, d.sameOwner ? 'admin.duplicateSame' : 'admin.duplicateOther', { title: d.title })} · <Link href={localePath(locale, `/ilan/${d.listingId}`)}>{t(locale, 'admin.openListing')}</Link>
                </p>
              ))}
              {l.changed ? <p className="small" style={{ margin: 0, color: 'var(--c-warning)' }}>{l.changed.length ? t(locale, 'admin.changedFields', { fields: l.changed.map((f) => t(locale, `admin.field.${f}`, {})).join(', ') }) : t(locale, 'admin.noChanges')}</p> : null}
              {l.previousRejectReason ? <p className="small" style={{ margin: 0, color: 'var(--c-danger)' }}>{t(locale, 'admin.previousReject')}: {t(locale, `admin.reasons.${l.previousRejectReason}`)}</p> : null}
              <ListingDecision id={l.id} version={l.version} L={L} reasons={tDict(locale, 'admin.reasons')} errors={tDict(locale, 'errors')} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
