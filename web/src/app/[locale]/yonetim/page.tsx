import type { Metadata } from 'next';
import Link from 'next/link';
import { localePath, t, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';

type P = { params: Promise<{ locale: string }> };
type Overview = {
  activeListings: number; pendingListings: number; pendingVerifications: number; openListingReports: number; users7d: number;
  openDisputes?: number; newLeads?: number; openBroker?: number; pendingReports?: number;
  oldestHours?: { listing: number | null; verification: number | null; report: number | null };
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.title') }), robots: { index: false, follow: false } };
}

/** Yönetim: yalnızca ekip (moderatör, yönetici); diğerleri için sayfa yoktur. */
export default async function Yonetim({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const o = await staffGet<Overview>(locale, '/admin/overview', '/yonetim');
  // Bekleyen işlerde en eski işin yaşı da yazılır (kuyruk ne kadar geride).
  const age = (h: number | null | undefined) => (h == null ? '' : 48 > h ? t(locale, 'admin.ageHours', { n: h }) : t(locale, 'admin.ageDays', { n: Math.floor(h / 24) }));
  const kpis: [string, number, string, string?][] = [
    ['admin.kpiPending', o.pendingListings, age(o.oldestHours?.listing), '/yonetim/ilanlar'],
    ['admin.kpiReports', o.openListingReports, age(o.oldestHours?.report), '/yonetim/bildirimler'],
    ['admin.kpiDocs', o.pendingVerifications, age(o.oldestHours?.verification), '/yonetim/belgeler'],
    ['admin.kpiDisputes', o.openDisputes ?? 0, '', '/yonetim/odemeler'],
    ['admin.kpiLeads', o.newLeads ?? 0, '', '/yonetim/talepler'],
    ['admin.kpiBroker', o.openBroker ?? 0, ''],
    ['admin.kpiExpertise', o.pendingReports ?? 0, ''],
    ['admin.kpiActive', o.activeListings, ''],
    ['admin.kpiUsers', o.users7d, ''],
  ];
  return (
    <section className="section">
      <h1>{t(locale, 'admin.title')}</h1>
      <AdminNav locale={locale} />
      <div className="grid">
        {kpis.map(([k, n, oldest, href]) => {
          const body = <><div style={{ fontSize: 32, fontWeight: 800 }}>{n}</div><div className="muted small">{t(locale, k)}</div>{n && oldest ? <div className="small" style={{ color: 'var(--c-warning)' }}>{t(locale, 'admin.oldest', { age: oldest })}</div> : null}</>;
          return href ? <Link key={k} href={localePath(locale, href)} className="card" style={{ color: 'inherit' }}>{body}</Link> : <div key={k} className="card">{body}</div>;
        })}
      </div>
    </section>
  );
}
