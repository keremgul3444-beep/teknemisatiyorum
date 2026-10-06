import type { Metadata } from 'next';
import { t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { ReviewToggle } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ gizli?: string }> };
type R = { id: string; stars: number; text: string; createdAt: string; hiddenAt: string | null; provider: { id: string; displayName: string; kind: string } | null };

export async function generateMetadata({ params }: Pick<P, 'params'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navReviews') }), robots: { index: false, follow: false } };
}

/** Usta/kaptan değerlendirmeleri: hakaret ya da kişisel veri içeren yorum gizlenir (puandan da düşer). */
export default async function Yorumlar({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const hiddenOnly = (await searchParams).gizli === '1';
  const rows = await staffGet<R[]>(locale, `/admin/reviews${hiddenOnly ? '?hidden=1' : ''}`, '/yonetim/yorumlar');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short' });
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navReviews')}</h1>
      <AdminNav locale={locale} current="/yonetim/yorumlar" />
      <p className="small"><a href={hiddenOnly ? '?' : '?gizli=1'}>{t(locale, hiddenOnly ? 'admin.allReviews' : 'admin.hiddenReviews')}</a></p>
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.noReviews')}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} className="card spread" style={{ gap: 12, opacity: r.hiddenAt ? 0.6 : 1 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong>{r.provider?.displayName ?? '—'} · {t(locale, 'admin.stars', { n: r.stars })}</strong>
                {r.text ? <span style={{ whiteSpace: 'pre-line' }}>{r.text}</span> : null}
                <span className="small muted">{fmt.format(new Date(r.createdAt))}{r.hiddenAt ? ` · ${t(locale, 'admin.hidden')}` : ''}</span>
              </div>
              <ReviewToggle id={r.id} hidden={!!r.hiddenAt} L={L} errors={tDict(locale, 'errors')} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
