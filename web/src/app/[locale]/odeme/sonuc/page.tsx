import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, type Locale } from '@/i18n';
import { ApiError } from '@/lib/api';
import { authedGet } from '@/lib/auth-server';

type SP = { order?: string | string[]; pay?: string | string[]; n?: string | string[] };
type P = { params: Promise<{ locale: string }>; searchParams: Promise<SP> };
type Order = { id: string; listingId: string; status: string };

const MAX_POLLS = 20;
const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'pay.resultTitle') }), robots: { index: false, follow: false } };
}

/**
 * Ödeme sonucu. Sonucu tarayıcının dönüşü değil sağlayıcının sunucuya bildirimi belirler; burada yalnızca
 * sipariş durumu okunur. Onay henüz gelmediyse sayfa birkaç saniyede bir kendini yeniler (sınırlı sayıda).
 */
export default async function OdemeSonuc({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const n = Math.min(Number(one(sp.n)) || 0, MAX_POLLS);
  if (one(sp.pay)) return <ServiceResult locale={locale} id={one(sp.pay)} n={n} />;
  const id = one(sp.order);
  if (!/^[a-z0-9]{8,40}$/.test(id)) notFound();
  const o = await authedGet<Order>(locale, `/orders/${id}`, `/odeme/sonuc?order=${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const listings = localePath(locale, '/hesabim/ilanlar');
  return (
    <section className="section" style={{ maxWidth: 560 }}>
      {o.status === 'pending' && n < MAX_POLLS ? <meta httpEquiv="refresh" content={`3;url=${localePath(locale, '/odeme/sonuc')}?order=${id}&n=${n + 1}`} /> : null}
      <h1>{t(locale, `pay.result.${o.status}`, {})}</h1>
      <p className="muted">{t(locale, `pay.resultBody.${o.status}`, {})}</p>
      <div className="row">
        <Link className="btn" href={listings}>{t(locale, 'account.listings')}</Link>
        {o.status === 'failed' || o.status === 'cancelled' ? <Link className="btn ghost" href={listings}>{t(locale, 'pay.retry')}</Link> : null}
      </div>
    </section>
  );
}

/** Emanet ödeme sonucu: bildirim gelene kadar kısa aralıklarla yenilenir; sonra uygulamaya dönme çağrısı. */
async function ServiceResult({ locale, id, n }: { locale: Locale; id: string; n: number }) {
  if (!/^[a-z0-9]{8,40}$/.test(id)) notFound();
  const p = await authedGet<{ id: string; status: string }>(locale, `/service-payments/${id}`, `/odeme/sonuc?pay=${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <section className="section" style={{ maxWidth: 560 }}>
      {p.status === 'pending' && n < MAX_POLLS ? <meta httpEquiv="refresh" content={`3;url=${localePath(locale, '/odeme/sonuc')}?pay=${id}&n=${n + 1}`} /> : null}
      <h1>{t(locale, `pay.servicePayStatus.${p.status}`, {})}</h1>
      <p className="muted">{t(locale, p.status === 'held' ? 'pay.backToApp' : p.status === 'failed' ? 'pay.serviceRetry' : 'pay.servicePending')}</p>
    </section>
  );
}
