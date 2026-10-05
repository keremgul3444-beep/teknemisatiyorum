import type { Metadata } from 'next';
import type { Currency } from '@tms/shared';
import { t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { formatPrice } from '@/lib/format';
import { AdminNav } from '@/components/AdminNav';
import { LeadStatus } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Lead = {
  id: string; kind: string; status: string; note: string; name: string | null; phone: string | null; createdAt: string;
  listing: { id: string; brand: string; model: string; year: number; price: number; currency: Currency } | null;
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navLeads') }), robots: { index: false, follow: false } };
}

/** Finansman / sigorta / nakliye teklif talepleri (kişi açık izin verdi); ekip iş ortağına iletir ve işaretler. */
export default async function Talepler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Lead[]>(locale, '/admin/leads', '/yonetim/talepler');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navLeads')}</h1>
      <AdminNav locale={locale} current="/yonetim/talepler" />
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.noLeads')}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} className="card spread" style={{ gap: 12, opacity: r.status === 'closed' ? 0.6 : 1 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong>{t(locale, `admin.leadKind.${r.kind}`)} · {t(locale, `admin.leadStatus.${r.status}`)}</strong>
                <span>{r.name ?? '—'} · {r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}</span>
                {r.listing ? <span className="small">{r.listing.brand} {r.listing.model} · {r.listing.year} · {formatPrice(r.listing.price, r.listing.currency, locale)}</span> : null}
                {r.note ? <span className="small muted">{r.note}</span> : null}
                <span className="small muted">{fmt.format(new Date(r.createdAt))}</span>
              </div>
              <LeadStatus id={r.id} status={r.status} L={L} errors={tDict(locale, 'errors')} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
