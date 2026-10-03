import type { Metadata } from 'next';
import { t, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';

type P = { params: Promise<{ locale: string }> };
type Row = { id: string; actorId: string | null; action: string; params: Record<string, string> | null; targetType: string | null; targetId: string | null; at: string };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navAudit') }), robots: { index: false, follow: false } };
}

/** Son 100 işlem kaydı (değiştirilemez). Bilinmeyen kayıt türü anahtarıyla gösterilir. */
export default async function Kayitlar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Row[]>(locale, '/admin/audit', '/yonetim/kayitlar');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const label = (r: Row) => {
    const key = r.action.replace(/^audit\./, '');
    try { return t(locale, `audit.${key}`, r.params ?? {}); } catch { return r.action; }
  };
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navAudit')}</h1>
      <AdminNav locale={locale} current="/yonetim/kayitlar" />
      <ul className="small" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <li key={r.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 6 }}>
            <span>{label(r)}</span>
            <span className="muted">{fmt.format(new Date(r.at))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
