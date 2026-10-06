import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet, staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { ConfirmAction, ManualOrder } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ durum?: string }> };
type Order = { id: string; listingId: string; listingTitle: string | null; productCode: string; channel: string; amountKurus: number; status: string; createdAt: string; paidAt: string | null; note: string | null; userName: string | null };
type Product = { code: string };
const STATUSES = ['', 'pending', 'paid', 'refunded', 'failed'];

export async function generateMetadata({ params }: Pick<P, 'params'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navOrders') }), robots: { index: false, follow: false } };
}

/** Öne çıkarma siparişleri (yalnızca yönetici): durum süzgeci, iade, havale/EFT ile elle sipariş. */
export default async function Siparisler({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const me = await staffGet<{ roles: string[] }>(locale, '/me', '/yonetim/siparisler');
  if (!me.roles.includes('admin')) notFound();
  const durum = (await searchParams).durum ?? '';
  const status = STATUSES.includes(durum) ? durum : '';
  const [rows, products] = await Promise.all([
    authedGet<Order[]>(locale, `/admin/orders${status ? `?status=${status}` : ''}`, '/yonetim/siparisler'),
    authedGet<Product[]>(locale, '/products', '/yonetim/siparisler').catch(() => [] as Product[]),
  ]);
  const L = tDict(locale, 'admin');
  const errors = tDict(locale, 'errors');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const tl = (k: number) => `₺${(k / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}`;
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navOrders')}</h1>
      <AdminNav locale={locale} current="/yonetim/siparisler" />
      <ManualOrder products={products.map((p) => ({ code: p.code, label: t(locale, `promo.product.${p.code}`, {}) }))} L={L} errors={errors} />
      <nav className="row small" style={{ margin: '16px 0 8px' }}>
        {STATUSES.map((s) => <Link key={s || 'all'} className="chip" aria-current={status === s ? 'page' : undefined} href={`${localePath(locale, '/yonetim/siparisler')}${s ? `?durum=${s}` : ''}`}>{t(locale, s ? `admin.orderStatus.${s}` : 'admin.qAll')}</Link>)}
      </nav>
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.noOrders')}</p> : (
        <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {rows.map((o) => (
            <li key={o.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 8 }}>
              <span>
                <strong>{t(locale, `promo.product.${o.productCode}`, {})}</strong> · {tl(o.amountKurus)} · {t(locale, `admin.orderStatus.${o.status}`, {})} · {o.channel}
                <br /><span className="muted">{o.listingTitle ?? '—'} · {o.userName ?? '—'} · {fmt.format(new Date(o.createdAt))}{o.note ? ` · ${o.note}` : ''}</span>
              </span>
              {o.status === 'paid' ? <ConfirmAction path={`orders/${o.id}/refund`} label={L.refund} confirm={L.refundConfirm} L={L} errors={errors} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
