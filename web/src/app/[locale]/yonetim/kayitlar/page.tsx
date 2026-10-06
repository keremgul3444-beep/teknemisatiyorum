import type { Metadata } from 'next';
import Link from 'next/link';
import { localePath, t, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
type Row = { id: string; actorId: string | null; actorName?: string | null; action: string; params: Record<string, string> | null; targetType: string | null; targetId: string | null; at: string };

export async function generateMetadata({ params }: Pick<P, 'params'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navAudit') }), robots: { index: false, follow: false } };
}

/** İşlem kaydı (değiştirilemez): 100'erli sayfa; yapan, işlem, hedef ve "yalnızca ekip" ile süzülür. */
export default async function Kayitlar({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const f = { actor: sp.actor ?? '', action: sp.action ?? '', target: sp.target ?? '', staff: sp.staff === '1' ? '1' : '', before: sp.before ?? '' };
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const rows = await staffGet<Row[]>(locale, `/admin/audit${qs ? `?${qs}` : ''}`, '/yonetim/kayitlar');
  const older = rows.length === 100 ? new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), before: rows[rows.length - 1].at }).toString() : null;
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const label = (r: Row) => {
    const key = r.action.replace(/^audit\./, '');
    try { return t(locale, `audit.${key}`, r.params ?? {}); } catch { return r.action; }
  };
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navAudit')}</h1>
      <AdminNav locale={locale} current="/yonetim/kayitlar" />
      <form className="row small" method="get" style={{ marginBottom: 12, alignItems: 'center' }}>
        <input className="input" name="action" defaultValue={f.action} aria-label={t(locale, 'admin.auditAction')} placeholder={t(locale, 'admin.auditAction')} style={{ maxWidth: 200 }} />
        <input className="input" name="target" defaultValue={f.target} aria-label={t(locale, 'admin.auditTarget')} placeholder={t(locale, 'admin.auditTarget')} style={{ maxWidth: 220 }} />
        {f.actor ? <input type="hidden" name="actor" value={f.actor} /> : null}
        <label className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><input type="checkbox" name="staff" value="1" defaultChecked={!!f.staff} />{t(locale, 'admin.staffOnly')}</label>
        <button className="btn ghost" type="submit">{t(locale, 'admin.search')}</button>
        {qs ? <Link href={localePath(locale, '/yonetim/kayitlar')}>{t(locale, 'admin.clearFilters')}</Link> : null}
      </form>
      <ul className="small" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <li key={r.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 6 }}>
            <span>{label(r)}{r.actorName ? <> · <Link className="muted" href={`${localePath(locale, '/yonetim/kayitlar')}?actor=${r.actorId}`}>{r.actorName}</Link></> : null}{r.targetType === 'user' && r.targetId ? <> · <Link className="muted" href={localePath(locale, `/yonetim/kullanicilar/${r.targetId}`)}>{t(locale, 'admin.openUser')}</Link></> : null}</span>
            <span className="muted">{fmt.format(new Date(r.at))}</span>
          </li>
        ))}
      </ul>
      {older ? <p className="small"><Link href={`${localePath(locale, '/yonetim/kayitlar')}?${older}`}>{t(locale, 'admin.olderRecords')}</Link></p> : null}
    </section>
  );
}
