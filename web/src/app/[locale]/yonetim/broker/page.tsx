import type { Metadata } from 'next';
import type { Currency } from '@tms/shared';
import { t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { formatPrice } from '@/lib/format';
import { AdminNav } from '@/components/AdminNav';
import { ConfirmAction } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Case = { id: string; boatName: string; step: number; askingPrice: number; currency: Currency; userName: string | null };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navBroker') }), robots: { index: false, follow: false } };
}

/** Broker dosyaları: adım ilerletme (sahibine bildirim gider). 4. adım son adımdır. */
export default async function Broker({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Case[]>(locale, '/admin/broker', '/yonetim/broker');
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navBroker')}</h1>
      <AdminNav locale={locale} current="/yonetim/broker" />
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.empty')}</p> : (
        <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {rows.map((c) => (
            <li key={c.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 8 }}>
              <span><strong>{c.boatName}</strong> · {formatPrice(c.askingPrice, c.currency, locale)} · {c.userName ?? '—'}<br /><span className="muted">{t(locale, 'admin.brokerStep', { n: c.step })}</span></span>
              {c.step < 4 ? <ConfirmAction path={`broker/${c.id}/advance`} label={L.advance} confirm={L.advanceConfirm} L={L} errors={tDict(locale, 'errors')} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
