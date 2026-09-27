import type { Metadata } from 'next';
import { t, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';

type P = { params: Promise<{ locale: string }> };
type Order = { id: string; listingTitle: string | null; productCode: string; channel: string; amountKurus: number; status: string; createdAt: string };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.orders') }), robots: { index: false, follow: false } };
}

export default async function Siparisler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await authedGet<Order[]>(locale, '/me/orders', '/hesabim/siparisler');
  const fmt = (k: number) => `₺${Math.round(k / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}`;
  return (
    <section className="section">
      <h1>{t(locale, 'account.orders')}</h1>
      {rows.length === 0 ? <p className="muted">{t(locale, 'account.noOrders')}</p> : (
        <table className="card" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['listing', 'product', 'amount', 'status', 'date'].map((c) => <th key={c} style={{ textAlign: 'left', padding: 8 }}>{t(locale, `account.col.${c}`)}</th>)}</tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid var(--c-line)' }}>
                <td style={{ padding: 8 }}>{o.listingTitle}</td>
                <td style={{ padding: 8 }}>{t(locale, `promo.product.${o.productCode}`, {})}</td>
                <td style={{ padding: 8 }}>{fmt(o.amountKurus)}</td>
                <td style={{ padding: 8 }}>{t(locale, `account.orderStatus.${o.status}`, {})}</td>
                <td style={{ padding: 8 }}>{o.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
