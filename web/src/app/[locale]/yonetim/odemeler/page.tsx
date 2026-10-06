import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { PaymentDecision } from '@/components/AdminActions';
import { formatKurus } from '@/lib/format';

type P = { params: Promise<{ locale: string }> };
type Pay = {
  id: string; subjectKind: 'job' | 'captain'; providerName: string | null; amountKurus: number; feeKurus: number; status: string;
  createdAt: string; autoReleaseAt: string | null; disputedAt: string | null; disputeNote: string | null;
  payerId: string; payerName?: string | null; providerUserId?: string | null;
  subject?: { title?: string; start?: string; days?: number; status: string } | null;
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navPayments') }), robots: { index: false, follow: false } };
}

/** Emanet ödemeler: sorun bildirilenler en üstte; ekip iade eder ya da hizmet verene aktarır. */
export default async function Odemeler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Pay[]>(locale, '/admin/service-payments', '/yonetim/odemeler');
  const tl = (k: number) => formatKurus(k, locale);
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
              <span className="small">{t(locale, `admin.payStatus.${p.status}`)}
                {p.subject ? ` · ${p.subject.title ?? t(locale, 'admin.bookingDates', { start: p.subject.start ?? '', days: p.subject.days ?? 0 })}` : ''}</span>
              <span className="small muted">
                {t(locale, 'admin.payer')}: <Link href={localePath(locale, `/yonetim/kullanicilar/${p.payerId}`)}>{p.payerName ?? '—'}</Link>
                {p.providerUserId ? <> · {t(locale, 'admin.provider')}: <Link href={localePath(locale, `/yonetim/kullanicilar/${p.providerUserId}`)}>{p.providerName ?? '—'}</Link></> : null}
                {p.disputedAt ? <> · <Link href={localePath(locale, `/yonetim/odemeler/${p.id}`)}>{t(locale, 'admin.disputeChat')}</Link></> : null}
              </span>
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
