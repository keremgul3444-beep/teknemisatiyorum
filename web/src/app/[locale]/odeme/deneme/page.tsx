import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { ApiError } from '@/lib/api';
import { authedGet } from '@/lib/auth-server';
import { DevPayButtons } from '@/components/AccountBits';
import { formatKurus } from '@/lib/format';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string | string[]; pay?: string | string[] }> };
type ServicePay = { id: string; subjectKind: 'job' | 'captain'; amountKurus: number; feeKurus: number; status: string };
type Order = { id: string; listingTitle: string | null; productCode: string; amountKurus: number; status: string };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'pay.devTitle') }), robots: { index: false, follow: false } };
}

/** Deneme ödeme sayfası (sanal POS yerine). Başkasının siparişi 404; tutar ve ilan sızmaz. */
export default async function DenemeOdeme({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  // Emanet hizmet ödemesi (usta işi, kaptan rezervasyonu): ayrı kayıt, aynı deneme düğmeleri.
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? '';
  if (one(sp.pay)) return <ServicePayPage locale={locale} id={one(sp.pay)} />;
  const id = one(sp.order);
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
        <strong style={{ fontSize: 24 }}>{formatKurus(o.amountKurus, locale)}</strong>
      </div>
      {o.status === 'pending'
        ? <DevPayButtons orderId={o.id} resultHref={result} errors={tDict(locale, 'errors')} labels={{ success: t(locale, 'pay.devSuccess'), failure: t(locale, 'pay.devFailure') }} />
        : <p>{t(locale, `account.orderStatus.${o.status}`, {})}</p>}
    </section>
  );
}

async function ServicePayPage({ locale, id }: { locale: Locale; id: string }) {
  if (!/^[a-z0-9]{8,40}$/.test(id)) notFound();
  const p = await authedGet<ServicePay>(locale, `/service-payments/${id}`, `/odeme/deneme?pay=${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const tl = (k: number) => formatKurus(k, locale);
  const result = `${localePath(locale, '/odeme/sonuc')}?pay=${p.id}`;
  return (
    <section className="section" style={{ maxWidth: 560 }}>
      <p className="banner" role="note">{t(locale, 'pay.devBanner')}</p>
      <h1>{t(locale, 'pay.devTitle')}</h1>
      <div className="card" style={{ display: 'grid', gap: 6, margin: '16px 0' }}>
        <span>{t(locale, `pay.service.${p.subjectKind}`)}</span>
        <span className="muted small">{t(locale, 'pay.serviceAmount')}: {tl(p.amountKurus)} · {t(locale, 'pay.serviceFee')}: {tl(p.feeKurus)}</span>
        <strong style={{ fontSize: 24 }}>{tl(p.amountKurus + p.feeKurus)}</strong>
        <span className="muted small">{t(locale, 'pay.escrowNote')}</span>
      </div>
      {p.status === 'pending'
        ? <DevPayButtons orderId={p.id} resultHref={result} errors={tDict(locale, 'errors')} labels={{ success: t(locale, 'pay.devSuccess'), failure: t(locale, 'pay.devFailure') }} />
        : <p>{t(locale, `pay.servicePayStatus.${p.status}`, {})}</p>}
    </section>
  );
}
