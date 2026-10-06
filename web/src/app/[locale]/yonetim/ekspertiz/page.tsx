import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { ExpertiseReport } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type B = { id: string; date: string; slot: string; reportStatus: string; score: number | null; listingId: string | null; packageName: string | null; userName: string | null };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navExpertise') }), robots: { index: false, follow: false } };
}

/** Ekspertiz randevuları: rapor puanı girilince rapor tamamlanır (60 ve üstü ilana "ekspertizli" rozeti). */
export default async function Ekspertiz({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<B[]>(locale, '/admin/expertise', '/yonetim/ekspertiz');
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navExpertise')}</h1>
      <AdminNav locale={locale} current="/yonetim/ekspertiz" />
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.empty')}</p> : (
        <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {rows.map((b) => (
            <li key={b.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 8 }}>
              <span>
                <strong>{b.date} · {b.slot}</strong> · {b.packageName ?? '—'} · {b.userName ?? '—'}
                {b.listingId ? <> · <Link href={localePath(locale, `/ilan/${b.listingId}`)}>{t(locale, 'admin.openListing')}</Link></> : null}
                <br /><span className="muted">{b.reportStatus === 'done' ? t(locale, 'admin.reportDone', { score: b.score ?? 0 }) : t(locale, 'admin.reportPending')}</span>
              </span>
              {b.reportStatus === 'pending' ? <ExpertiseReport id={b.id} L={L} errors={tDict(locale, 'errors')} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
