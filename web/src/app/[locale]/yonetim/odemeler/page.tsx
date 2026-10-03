import type { Metadata } from 'next';
import { t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { PaymentDecision } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Pay = {
  id: string; subjectKind: 'job' | 'captain'; providerName: string | null; amountKurus: number; feeKurus: number; status: string;
  createdAt: string; autoReleaseAt: string | null; disputedAt: string | null; disputeNote: string | null;
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navPayments') }), robots: { index: false, follow: false } };
}

/** Emanet ödemeler: sorun bildirilenler en üstte; ekip iade eder ya da hizmet verene aktarır. */
export default async function Odemeler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Pay[]>(locale, '/admin/service-payments', '/yonetim/odemeler');
  const tl = (k: number) => `₺${(k / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })}`;
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navPayments')}</h1>
      <AdminNav locale={locale} current="/yonetim/odemeler" />
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.paymentsEmpty')}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((p) => (
            <article key={p.id} className="card" style={{ display: 'grid', gap: 8 }}>
              <div className="spread">
                <strong>{t(locale, `admin.service_${p.subjectKind}`)} · {p.providerName ?? '—'}</strong>
                <span>{tl(p.amountKurus)} <span className="muted small">+ {tl(p.feeKurus)} {t(locale, 'admin.fee')}</span></span>
              </div>
              <span className="small">{t(locale, `admin.payStatus.${p.status}`)}</span>
              {p.status === 'held' && p.disputedAt ? <p className="small" role="note" style={{ margin: 0, color: 'var(--c-danger)' }}>{t(locale, 'admin.disputed')}: {p.disputeNote}</p>
                : p.status === 'held' && p.autoReleaseAt ? <p className="small muted" style={{ margin: 0 }}>{t(locale, 'admin.autoReleaseAt', { date: p.autoReleaseAt.slice(0, 10) })}</p> : null}
              {p.status === 'held' ? <PaymentDecision id={p.id} L={tDict(locale, 'admin')} errors={tDict(locale, 'errors')} /> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
