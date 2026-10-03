import type { Metadata } from 'next';
import { t, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';

type P = { params: Promise<{ locale: string }> };
type Overview = { activeListings: number; pendingListings: number; pendingVerifications: number; openListingReports: number; users7d: number };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.title') }), robots: { index: false, follow: false } };
}

/** Yönetim: yalnızca ekip (moderatör, yönetici); diğerleri için sayfa yoktur. */
export default async function Yonetim({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const o = await staffGet<Overview>(locale, '/admin/overview', '/yonetim');
  const kpis: [string, number][] = [['admin.kpiPending', o.pendingListings], ['admin.kpiReports', o.openListingReports], ['admin.kpiDocs', o.pendingVerifications], ['admin.kpiActive', o.activeListings], ['admin.kpiUsers', o.users7d]];
  return (
    <section className="section">
      <h1>{t(locale, 'admin.title')}</h1>
      <AdminNav locale={locale} />
      <div className="grid">
        {kpis.map(([k, n]) => <div key={k} className="card"><div style={{ fontSize: 32, fontWeight: 800 }}>{n}</div><div className="muted small">{t(locale, k)}</div></div>)}
      </div>
    </section>
  );
}
