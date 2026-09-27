import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { ApiError } from '@/lib/api';
import { authedGet } from '@/lib/auth-server';
import { DevPayButtons } from '@/components/AccountBits';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string | string[] }> };
type Order = { id: string; listingTitle: string | null; productCode: string; amountKurus: number; status: string };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'pay.devTitle') }), robots: { index: false, follow: false } };
}

/** Deneme ödeme sayfası (sanal POS yerine). Başkasının siparişi 404; tutar ve ilan sızmaz. */
export default async function DenemeOdeme({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const raw = (await searchParams).order;
  const id = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  if (!/^[a-z0-9]{8,40}$/.test(id)) notFound();
  const o = await authedGet<Order>(locale, `/orders/${id}`, `/odeme/deneme?order=${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const result = `${localePath(locale, '/odeme/sonuc')}?order=${o.id}`;
  return (
    <section className="section" style={{ maxWidth: 560 }}>
      <p className="banner" role="note">{t(locale, 'pay.devBanner')}</p>
      <h1>{t(locale, 'pay.devTitle')}</h1>
      <div className="card" style={{ display: 'grid', gap: 6, margin: '16px 0' }}>
        <span>{o.listingTitle}</span>
        <span>{t(locale, `promo.product.${o.productCode}`, {})}</span>
        <strong style={{ fontSize: 24 }}>₺{Math.round(o.amountKurus / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}</strong>
      </div>
      {o.status === 'pending'
        ? <DevPayButtons orderId={o.id} resultHref={result} errors={tDict(locale, 'errors')} labels={{ success: t(locale, 'pay.devSuccess'), failure: t(locale, 'pay.devFailure') }} />
        : <p>{t(locale, `account.orderStatus.${o.status}`, {})}</p>}
    </section>
  );
}
