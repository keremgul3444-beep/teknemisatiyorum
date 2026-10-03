import type { Metadata } from 'next';
import { t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { UserSuspend } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type U = { id: string; name: string | null; roles: string[]; verifyLevel: number; createdAt: string; suspendedAt: string | null; suspendReason: string | null; phone: string | null };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navUsers') }), robots: { index: false, follow: false } };
}

/** Kullanıcılar (telefon maskeli): seviye, rol, askı durumu. */
export default async function Kullanicilar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<U[]>(locale, '/admin/users', '/yonetim/kullanicilar');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short' });
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navUsers')}</h1>
      <AdminNav locale={locale} current="/yonetim/kullanicilar" />
      <div style={{ overflowX: 'auto' }}>
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left' }}><th>{t(locale, 'admin.who')}</th><th>{t(locale, 'admin.level')}</th><th>{t(locale, 'admin.role')}</th><th>{t(locale, 'admin.joined')}</th><th /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--c-line)' }}>
                <td style={{ padding: '8px 4px' }}>{u.name ?? '—'}<div className="muted">{u.phone}</div>{u.suspendedAt ? <div style={{ color: 'var(--c-danger)' }}>{t(locale, 'admin.suspended')}: {u.suspendReason}</div> : null}</td>
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
