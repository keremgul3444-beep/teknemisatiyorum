import Link from 'next/link';
import type { Metadata } from 'next';
import type { Currency } from '@tms/shared';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { formatPrice } from '@/lib/format';
import { AdminNav } from '@/components/AdminNav';
import { ReportActions } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Group = {
  listing: { id: string; title: string; year: number; price: number; currency: Currency; status: string; description: string; owner: { id: string; name: string | null; verifyLevel: number; suspended: boolean } };
  count: number; reports: { id: string; reason: string; note: string; createdAt: string; reporterName: string | null }[];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navReports') }), robots: { index: false, follow: false } };
}

/** Bildirilen ilanlar: en çok bildirilen önce; kaldır, yoksay ya da satıcıyı askıya al. */
export default async function Bildirimler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const groups = await staffGet<Group[]>(locale, '/admin/reports', '/yonetim/bildirimler');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navReports')}</h1>
      <AdminNav locale={locale} current="/yonetim/bildirimler" />
      {groups.length === 0 ? <p className="muted">{t(locale, 'admin.reportsEmpty')}</p> : (
        <div style={{ display: 'grid', gap: 16 }}>
          {groups.map((g) => (
            <article key={g.listing.id} className="card" style={{ display: 'grid', gap: 10 }}>
              <div className="spread">
                <h2 style={{ margin: 0 }}><Link href={localePath(locale, `/ilan/${g.listing.id}`)}>{g.listing.title} · {g.listing.year}</Link></h2>
                <span className="chip">{t(locale, 'admin.reportCount', { n: g.count })}</span>
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                {formatPrice(g.listing.price, g.listing.currency, locale)} · {t(locale, `admin.status.${g.listing.status}`)} · {t(locale, 'admin.by', { who: g.listing.owner.name ?? '—' })}
                {g.listing.owner.suspended ? ` · ${t(locale, 'admin.suspended')}` : ''}
              </p>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {g.reports.map((r) => (
                  <li key={r.id}>{t(locale, `admin.reportReasons.${r.reason}`)}{r.note ? `: ${r.note}` : ''} <span className="muted">· {r.reporterName ?? '—'} · {fmt.format(new Date(r.createdAt))}</span></li>
                ))}
              </ul>
              <ReportActions listingId={g.listing.id} ownerId={g.listing.owner.id} suspended={g.listing.owner.suspended}
                L={tDict(locale, 'admin')} takedown={tDict(locale, 'admin.takedownReasons')} errors={tDict(locale, 'errors')} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
