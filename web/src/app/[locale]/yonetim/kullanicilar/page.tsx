import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { UserSuspend } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };
type U = { id: string; name: string | null; roles: string[]; verifyLevel: number; createdAt: string; suspendedAt: string | null; suspendReason: string | null; phone: string | null; reregistered?: boolean };

export async function generateMetadata({ params }: Pick<P, 'params'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navUsers') }), robots: { index: false, follow: false } };
}

/** Kullanıcılar (telefon maskeli): seviye, rol, askı durumu; telefon ya da adla arama. */
export default async function Kullanicilar({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const q = ((await searchParams).q ?? '').trim().slice(0, 60);
  const rows = await staffGet<U[]>(locale, `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, '/yonetim/kullanicilar');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short' });
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navUsers')}</h1>
      <AdminNav locale={locale} current="/yonetim/kullanicilar" />
      <form className="row" method="get" style={{ marginBottom: 12 }}>
        <input className="input" name="q" defaultValue={q} aria-label={t(locale, 'admin.userSearch')} placeholder={t(locale, 'admin.userSearch')} style={{ maxWidth: 320 }} />
        <button className="btn ghost" type="submit">{t(locale, 'admin.search')}</button>
      </form>
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.noUsers')}</p> : null}
      <div style={{ overflowX: 'auto' }}>
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left' }}><th>{t(locale, 'admin.who')}</th><th>{t(locale, 'admin.level')}</th><th>{t(locale, 'admin.role')}</th><th>{t(locale, 'admin.joined')}</th><th /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--c-line)' }}>
                <td style={{ padding: '8px 4px' }}><Link href={localePath(locale, `/yonetim/kullanicilar/${u.id}`)}>{u.name ?? '—'}</Link><div className="muted">{u.phone}</div>{u.suspendedAt ? <div style={{ color: 'var(--c-danger)' }}>{t(locale, 'admin.suspended')}: {u.suspendReason}</div> : null}{u.reregistered ? <div style={{ color: 'var(--c-warning)' }}>{t(locale, 'admin.reregistered')}</div> : null}</td>
                <td>{u.verifyLevel}</td>
                <td>{u.roles.join(', ') || '—'}</td>
                <td>{fmt.format(new Date(u.createdAt))}</td>
                <td>{u.roles.length ? null : <UserSuspend id={u.id} suspended={!!u.suspendedAt} L={tDict(locale, 'admin')} errors={tDict(locale, 'errors')} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
